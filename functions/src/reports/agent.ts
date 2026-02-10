import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { generateMarketReportInternal } from "./marketReport";
import { notifyMarketScan } from "../notifications/notifications";
import { HistoricalRepository } from "../lib/historicalRepository";
import { getMarketDataProvider } from "@/lib/marketDataProvider";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { PUBLIC_API_SECRET } from "@/lib/publicMarketData";
import { processCandidate } from "./agentCandidate";
import { buildUpcomingEarningsKeyDates } from "./agentUtils";


async function runMarathonAgentInternal(sessionOverride?: "open" | "close", marketModeOverride?: string) {
    logger.info('🏁 Marathon Agent: Daily Scan Started');
    const db = admin.firestore();
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Fetch User Preference for Risk Level
    const userPrefs = await db.collection('settings').doc('default').get();
    const riskLevel = userPrefs.data()?.riskLevel ?? 'moderate';
    const thresholds = {
        aggressive: 55,
        moderate: 70,
        conservative: 85
    };
    const riskKey = riskLevel as keyof typeof thresholds;
    const confidenceThreshold = thresholds[riskKey] ?? 70;

    logger.info(`Using Risk Level: ${riskLevel} (Threshold: ${confidenceThreshold})`);

    const marketDataProvider = getMarketDataProvider(marketModeOverride);
    const marketSnapshots = await marketDataProvider.getMarketSnapshot();

    if (marketSnapshots.length === 0) {
        logger.info('No market data available for scan.');
        return null;
    }

    // 1. Filter Candidates (The strict rules)
    let candidates = marketSnapshots.filter(stock => (stock.ivRank ?? 0) > 50);
    logger.info(`Found ${candidates.length} candidates with high IV.`, { symbols: candidates.map(c => c.symbol) });

    // Fallback Phase 1: High IV Candidates (Loosen from 50 to 30)
    if (candidates.length < 3) {
        logger.info('Fewer than 3 candidates found with IV > 50. Loosening filter to IV > 30.');
        candidates = marketSnapshots.filter(stock => (stock.ivRank ?? 0) > 30);
    }

    // Fallback Phase 2: Pick top 3 by raw IV regardless of threshold
    if (candidates.length < 3) {
        logger.info(`Still only ${candidates.length} candidates. Picking top 3 by raw IV.`);
        candidates = [...marketSnapshots]
            .sort((a, b) => (b.ivRank ?? 0) - (a.ivRank ?? 0))
            .slice(0, 3);
    }

    // NEW: Check for Idiosyncratic "Signature Plays"
    // This simulates the Agent looking for A+ setups regardless of generic IV rank
    const historicalRepo = new HistoricalRepository();
    const historicalContexts = await historicalRepo.getHistoricalContext(marketSnapshots.map(s => s.symbol), 
        Object.fromEntries(marketSnapshots.map(s => [s.symbol, s.price]))
    );

    const signaturePlays = marketSnapshots.filter(stock => {
        const ctx = historicalContexts[stock.symbol];
        
        // Oversold RSI check
        if (ctx?.rsi_14 && ctx.rsi_14 < 35) {
            logger.info(`🎯 Signature Play (Oversold): ${stock.symbol} RSI=${ctx.rsi_14.toFixed(1)}`);
            return true;
        }

        // Support level check (within 2% of 200-day SMA or 52-week low)
        if (ctx?.sma_200 && stock.price < ctx.sma_200 * 1.02 && stock.price > ctx.sma_200 * 0.95) {
            logger.info(`🎯 Signature Play (SMA200 Support): ${stock.symbol} @ ${stock.price} (SMA200=${ctx.sma_200.toFixed(1)})`);
            return true;
        }

        if (stock.symbol === 'TSLA' && stock.price < 200) {
            logger.info(`🎯 Signature Play detected: ${stock.symbol} @ ${stock.price}`);
            return true;
        }
        if (stock.symbol === 'NVDA' && (stock.ivRank ?? 0) > 70) return true; // High Premium Crush
        return false;
    });

    // Final merge and cap
    const allCandidates = [...new Set([...candidates, ...signaturePlays])];
    if (allCandidates.length < 3) {
        // Absolute fallback: Just take first 3 from snapshots if we still don't have enough
        marketSnapshots.forEach(s => {
            if (allCandidates.length < 3 && !allCandidates.find(c => c.symbol === s.symbol)) {
                allCandidates.push(s);
            }
        });
    }

    if (signaturePlays.length > 0) {
        logger.info(`🎯 Marathon Agent found ${signaturePlays.length} ASYMMETRIC SIGNATURE PLAYS:`, { symbols: signaturePlays.map(s => s.symbol) });
    }

    // Parallel Processing with Concurrency Limit (Batch of 3)
    const CHUNK_SIZE = 3;
    for (let i = 0; i < allCandidates.length; i += CHUNK_SIZE) {
        const chunk = allCandidates.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(stock =>
            processCandidate(stock, db, batch, timestamp, confidenceThreshold)
        ));
    }

    await batch.commit();
    logger.info('🏁 Marathon Agent: Scan Complete');

    // Determine session (open = 9:30 AM, close = 3:30 PM)
    const now = new Date();
    const nyTime = now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
    const nyHour = parseInt(nyTime.split(':')[0], 10);
    const session: "open" | "close" = sessionOverride || (nyHour < 12 ? "open" : "close");

    // UNIQUE ID for manual/intraday scans
    let reportIdOverride: string | undefined;
    if (sessionOverride) {
        // If session is explicitly provided, it's likely a manual or specific intraday trigger
        const today = now.toISOString().split('T')[0];
        const timeSuffix = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
        reportIdOverride = `${today}-intraday-${timeSuffix}`;
    }

    // Generate shareable market report
    try {
        const positions = marketSnapshots.map(s => ({
            symbol: s.symbol,
            quantity: 100,
            currentPrice: s.price
        }));

        // Use candidates specifically, but ideally, we should fetch *created* opportunities from DB
        // For now, we reuse the candidate logic to define "potentials" for the report, 
        // but in a real scenario we might want to only report on what we actually saved.
        // Sticking to original logic for report generation consistency but adding synopsis support.

        const expirationDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
        const expirationLabel = expirationDate.toISOString().split('T')[0];
        const opportunities = allCandidates.map(c => ({
            symbol: c.symbol,
            strategy: "Cash-Secured Put" as const,
            strike: Math.round(c.price * 0.95),
            expiration: expirationLabel,
            premium: Math.round(c.price * 0.02 * 100) / 100,
            annualizedYield: Math.round((c.price * 0.02 / c.price) * (365 / 30) * 1000) / 10,
            winProb: 70,
            ivRank: c.ivRank ?? 0,
            risk: `Assigned at $${Math.round(c.price * 0.95)}`,
            reward: `Premium income`,
            currentPrice: c.price
        }));

        const upcomingKeyDates = buildUpcomingEarningsKeyDates(marketSnapshots, now);
        const report = await generateMarketReportInternal(
            session,
            positions,
            opportunities,
            reportIdOverride,
            upcomingKeyDates
        );
        logger.info(`📊 Report generated: ${report.reportUrl}`);

        // Send push notification without blocking report delivery.
        try {
            await notifyMarketScan(report.reportId, report.reportUrl, session, report.headline);
        } catch (error) {
            logger.error('Failed to send market scan notification:', error);
        }
        return report;
    } catch (error) {
        logger.error('Failed to generate report:', error);
    }

    return null;
}

// Scheduled for 9:30 AM and 3:30 PM ET, Mon-Fri
// Scheduled for 9:30 AM and 3:30 PM ET, Mon-Fri
export const runMarathonAgent = onSchedule({
    timeoutSeconds: 540,
    memory: "1GiB",
    schedule: '30 9,15 * * 1-5',
    timeZone: 'America/New_York',
    secrets: [PUBLIC_API_SECRET]
}, async (event) => {
    await runMarathonAgentInternal();
});

/**
 * Manual trigger for the Marathon Agent (secured by API key).
 */
/**
 * Manual trigger for the Marathon Agent (secured by API key).
 */
export const runMarathonAgentManual = onRequest({
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [PUBLIC_API_SECRET]
}, async (req: any, res: any) => {
    if (req.method !== 'POST') {
        res.set('Allow', 'POST').status(405).send('Method Not Allowed');
        return;
    }

    const { bridgeApiKey } = requireIbkrBridge();
    const providedKey = req.get('X-API-KEY') || req.get('x-api-key') || '';
    if (bridgeApiKey && providedKey !== bridgeApiKey) {
        res.status(401).send('Unauthorized');
        return;
    }

    const sessionValue = typeof req.query.session === 'string'
        ? req.query.session
        : typeof req.body?.session === 'string'
            ? req.body.session
            : null;
    const session = sessionValue === 'open' || sessionValue === 'close' ? sessionValue : undefined;

    const marketValue = typeof req.query.market === 'string'
        ? req.query.market
        : typeof req.query.mode === 'string'
            ? req.query.mode
            : typeof req.body?.market === 'string'
                ? req.body.market
                : null;

    try {
        const report = await runMarathonAgentInternal(session, marketValue || undefined);
        res.status(200).json({
            success: true,
            reportId: report?.reportId ?? null,
            reportUrl: report?.reportUrl ?? null,
            headline: report?.headline ?? null
        });
    } catch (error) {
        logger.error('Manual Marathon Agent run failed:', error);
        res.status(500).json({ error: 'Failed to run Marathon Agent' });
    }
});
