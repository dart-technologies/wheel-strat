import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { getMarketDataProvider } from "@/lib/marketDataProvider";
import { HistoricalRepository } from "@/lib/historicalRepository";
import { loadOpportunitiesForWindow } from "./verifyMarathonAgentData";
import {
    buildPredictionId,
    computeVolatility,
    evaluateOutcome,
    extractAnalysis,
    normalizeSymbol,
    parseDate,
    parseNumber,
    resolveStrategyType
} from "./verifyMarathonAgentUtils";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = Math.max(1, Number(process.env.PREDICTION_LOOKBACK_DAYS || "30"));

export async function verifyMarathonAgentInternal(now = new Date()) {
    const db = admin.firestore();
    const targetDate = new Date(now.getTime() - (LOOKBACK_DAYS * DAY_MS));
    const opportunities = await loadOpportunitiesForWindow(db, targetDate);

    if (opportunities.length === 0) {
        logger.info("No opportunities found for prediction verification.");
        return { processed: 0, written: 0 };
    }

    const symbols = Array.from(new Set(opportunities.map((opp) => normalizeSymbol(opp.symbol)).filter(Boolean)));
    const marketDataProvider = getMarketDataProvider();
    const snapshots = await marketDataProvider.getMarketSnapshot(symbols);
    const priceMap = new Map<string, number>();
    snapshots.forEach((snapshot) => {
        if (snapshot?.symbol && Number.isFinite(snapshot.price)) {
            priceMap.set(snapshot.symbol.toUpperCase(), snapshot.price);
        }
    });

    const historicalRepo = new HistoricalRepository();
    const historicalContext = await historicalRepo.getHistoricalContext(symbols);

    type Candidate = { id: string; data: Record<string, any> };
    const candidates: Candidate[] = [];

    for (const opp of opportunities) {
        const symbol = normalizeSymbol(opp.symbol);
        if (!symbol) continue;
        const strike = parseNumber(opp.strike);
        if (!strike) continue;
        const strategyType = resolveStrategyType(opp.strategy);
        if (!strategyType) continue;
        const currentPrice = priceMap.get(symbol);
        if (!currentPrice) continue;

        const createdAt = parseDate(opp.createdAt) || parseDate(opp.updatedAt) || null;
        const analysis = extractAnalysis(opp.analysis);
        const verdict = typeof analysis?.verdict === "string"
            ? analysis.verdict
            : typeof opp.reasoning === "string"
                ? opp.reasoning
                : undefined;
        const target = parseNumber(analysis?.scenarios?.bull?.target) ?? strike;
        const outcome = evaluateOutcome(strategyType, strike, currentPrice);
        const history = historicalContext[symbol];
        const volatility = computeVolatility(history?.priceHistory);

        candidates.push({
            id: buildPredictionId(symbol, createdAt, strike, strategyType),
            data: {
                symbol,
                strategy: opp.strategy,
                strike,
                expiration: typeof opp.expiration === "string" ? opp.expiration : undefined,
                verdict,
                target,
                outcome: outcome.outcome,
                success: outcome.success,
                ivRank: parseNumber(opp.ivRank) ?? undefined,
                rsi: typeof history?.rsi_14 === "number" ? history.rsi_14 : undefined,
                volatility: volatility ?? undefined,
                evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: createdAt ? createdAt.toISOString() : undefined
            }
        });
    }

    if (candidates.length === 0) {
        logger.info("No eligible opportunities for verification.");
        return { processed: 0, written: 0 };
    }

    const refs = candidates.map((candidate) => db.collection("prediction_history").doc(candidate.id));
    const existing = await db.getAll(...refs);
    const existingIds = new Set(existing.filter((doc) => doc.exists).map((doc) => doc.id));

    let batch = db.batch();
    let batchCount = 0;
    let written = 0;

    for (const candidate of candidates) {
        if (existingIds.has(candidate.id)) continue;
        batch.set(db.collection("prediction_history").doc(candidate.id), candidate.data, { merge: true });
        batchCount += 1;
        written += 1;
        if (batchCount >= 450) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    logger.info("Prediction verification complete.", { processed: candidates.length, written });
    return { processed: candidates.length, written };
}

export const verifyMarathonAgent = onSchedule({
    schedule: "0 6 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async () => {
    await verifyMarathonAgentInternal();
});

export const verifyMarathonAgentManual = onRequest({
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (req: any, res: any) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST").status(405).send("Method Not Allowed");
        return;
    }
    const result = await verifyMarathonAgentInternal();
    res.status(200).json({ success: true, ...result });
});
