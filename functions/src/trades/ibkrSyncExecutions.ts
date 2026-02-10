import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { normalizeBridgeUrl } from "@wheel-strat/shared";
import { fetchOptionQuote, getMarketDataProvider } from "@/lib/marketDataProvider";
import { HistoricalRepository } from "@/lib/historicalRepository";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import {
    buildOptionKey,
    formatExpirationDashed,
    isOptionExecution,
    normalizeRight
} from "./ibkrSyncNormalize";
import { normalizeExpiration, toNumber } from "./ibkrSyncUtils";
import { IBKRExecution } from "./ibkrSyncTypes";
import {
    buildExecutionDocId,
    buildExecutionKey,
    chunkArray,
    stripUndefined
} from "./ibkrSyncStore";

export async function writeExecutions(executions: IBKRExecution[], fallbackUserId?: string) {
    const db = admin.firestore();
    const deduped = new Map<string, IBKRExecution>();
    for (const exec of executions) {
        if (!exec?.execId) continue;
        const key = buildExecutionKey(exec);
        if (!deduped.has(key)) {
            deduped.set(key, exec);
        }
    }

    const uniqueExecutions = Array.from(deduped.values());
    if (uniqueExecutions.length === 0) {
        return { fills: 0, fallbackUsed: 0 };
    }

    const symbols = Array.from(new Set(uniqueExecutions
        .map((exec) => exec.symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol))));

    const snapshotMap = new Map<string, { price?: number; ivRank?: number }>();
    const rsiMap = new Map<string, number>();
    let vixLevel: number | undefined;

    if (symbols.length > 0) {
        try {
            const provider = getMarketDataProvider();
            const snapshots = await provider.getMarketSnapshot(symbols);
            snapshots.forEach((snapshot) => {
                if (!snapshot?.symbol) return;
                snapshotMap.set(snapshot.symbol.toUpperCase(), {
                    price: snapshot.price,
                    ivRank: snapshot.ivRank
                });
            });
            const vixSnapshots = await provider.getMarketSnapshot(["VIX"]);
            const vixCandidate = vixSnapshots?.[0]?.price;
            if (Number.isFinite(vixCandidate)) {
                vixLevel = vixCandidate;
            }
        } catch (error) {
            logger.warn("Trade context market snapshot failed", { error: (error as Error)?.message });
        }
    }

    if (symbols.length > 0) {
        try {
            const historicalRepo = new HistoricalRepository();
            await Promise.all(symbols.map(async (symbol) => {
                const price = snapshotMap.get(symbol)?.price;
                if (!Number.isFinite(price)) return;
                const rsi = await historicalRepo.calculateLiveRSI(symbol, price as number);
                if (typeof rsi === "number" && Number.isFinite(rsi)) {
                    rsiMap.set(symbol, rsi);
                }
            }));
        } catch (error) {
            logger.warn("Trade context RSI snapshot failed", { error: (error as Error)?.message });
        }
    }

    const optionQuoteMap = new Map<string, { delta?: number; theta?: number }>();
    const optionKeys = new Map<string, IBKRExecution>();
    uniqueExecutions.forEach((exec) => {
        if (!isOptionExecution(exec)) return;
        const key = buildOptionKey(exec);
        if (!key) return;
        if (!optionKeys.has(key)) {
            optionKeys.set(key, exec);
        }
    });

    if (optionKeys.size > 0) {
        const { bridgeUrl, bridgeApiKey } = requireIbkrBridge();
        const normalizedBridgeUrl = bridgeUrl ? normalizeBridgeUrl(bridgeUrl) : "";
        await Promise.all(Array.from(optionKeys.entries()).map(async ([key, exec]) => {
            const right = normalizeRight(exec.right);
            const strike = toNumber(exec.strike);
            const expirationDigits = normalizeExpiration(exec.expiration);
            const expirationDashed = formatExpirationDashed(exec.expiration);
            const expirationCandidates = [
                expirationDashed,
                expirationDigits && expirationDigits !== expirationDashed ? expirationDigits : null
            ].filter((value): value is string => Boolean(value));
            if (!right || !Number.isFinite(strike) || expirationCandidates.length === 0) return;
            try {
                for (const expiration of expirationCandidates) {
                    const quote = await fetchOptionQuote(
                        normalizedBridgeUrl,
                        exec.symbol,
                        strike as number,
                        expiration,
                        right,
                        bridgeApiKey
                    );
                    if (!quote) continue;
                    const delta = typeof quote.delta === "number" ? quote.delta : undefined;
                    const theta = typeof quote.theta === "number" ? quote.theta : undefined;
                    if (delta === undefined && theta === undefined) continue;
                    optionQuoteMap.set(key, { delta, theta });
                    break;
                }
            } catch (error) {
                logger.warn("Trade context option quote failed", {
                    symbol: exec.symbol,
                    error: (error as Error)?.message
                });
            }
        }));
    }

    const execIdCounts = new Map<string, number>();
    uniqueExecutions.forEach((exec) => {
        execIdCounts.set(exec.execId, (execIdCounts.get(exec.execId) ?? 0) + 1);
    });
    const execByDocId = new Map<string, IBKRExecution>();
    uniqueExecutions.forEach((exec) => {
        const docId = buildExecutionDocId(exec, execIdCounts);
        if (!execByDocId.has(docId)) {
            execByDocId.set(docId, exec);
        }
    });

    const refs = Array.from(execByDocId.keys()).map((docId) => db.collection("user_trades").doc(docId));
    const existingIds = new Set<string>();
    const existingDocs = new Map<string, admin.firestore.DocumentSnapshot>();
    const refChunks = chunkArray(refs, 200);
    for (const chunk of refChunks) {
        const snapshots = await db.getAll(...chunk);
        for (const snap of snapshots) {
            if (snap.exists) {
                existingIds.add(snap.id);
                existingDocs.set(snap.id, snap);
            }
        }
    }

    let newFills = 0;
    let fallbackUsed = 0;
    let fallbackMismatch = 0;
    let reassigned = 0;
    let batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 450;

    for (const [docId, exec] of execByDocId.entries()) {
        const tradeRef = db.collection("user_trades").doc(docId);
        const orderRef = exec.orderRef ? String(exec.orderRef).trim() : '';
        const hasOrderRef = orderRef.length > 0;
        const matchesFallback = Boolean(fallbackUserId && hasOrderRef && orderRef === fallbackUserId);

        if (existingIds.has(docId)) {
            if (matchesFallback) {
                const existingUserId = existingDocs.get(docId)?.get('userId');
                const shouldReassign = !existingUserId || existingUserId === orderRef;
                if (shouldReassign) {
                    batch.update(tradeRef, { userId: fallbackUserId });
                    reassigned += 1;
                    batchCount += 1;
                    if (batchCount >= maxBatchSize) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
            }
            continue;
        }

        if (fallbackUserId && !matchesFallback) {
            if (!hasOrderRef) {
                logger.info("Skipping execution without orderRef (manual sync)", { execId: exec.execId });
            } else {
                fallbackMismatch += 1;
            }
            continue;
        }

        if (!fallbackUserId && !hasOrderRef) {
            continue;
        }
        const dateObj = new Date(exec.time || Date.now());
        const dateStr = !isNaN(dateObj.getTime())
            ? dateObj.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

        const userId = fallbackUserId || orderRef;

        const isOption = isOptionExecution(exec);
        const multiplier = isOption ? (toNumber(exec.multiplier) ?? 100) : 1;
        const shares = toNumber(exec.shares) ?? toNumber(exec.cumQty) ?? 0;
        const resolvedPrice = toNumber(exec.avgPrice) ?? toNumber(exec.price) ?? 0;

        const snapshot = snapshotMap.get(exec.symbol.toUpperCase());
        const rawIvRank = snapshot?.ivRank;
        const entryIvRank = typeof rawIvRank === 'number' && Number.isFinite(rawIvRank) ? rawIvRank : null;
        const entryVix = typeof vixLevel === 'number' && Number.isFinite(vixLevel) ? vixLevel : null;
        const rawRsi = rsiMap.get(exec.symbol.toUpperCase());
        const entryRsi = typeof rawRsi === 'number' && Number.isFinite(rawRsi) ? rawRsi : null;

        const optionKey = isOption ? buildOptionKey(exec) : null;
        const optionQuote = optionKey ? optionQuoteMap.get(optionKey) : null;
        const entryDelta = typeof optionQuote?.delta === "number" ? optionQuote.delta : null;
        const entryTheta = typeof optionQuote?.theta === "number" ? optionQuote.theta : null;

        const normalizedRight = normalizeRight(exec.right);
        const payload = stripUndefined({
            symbol: exec.symbol,
            type: exec.side === "BOT" ? "BUY" : "SELL",
            quantity: shares,
            price: resolvedPrice || null,
            date: dateStr,
            total: shares * resolvedPrice * multiplier,
            commission: exec.commission ?? 0,
            entryIvRank,
            entryVix,
            entryDelta,
            entryTheta,
            entryRsi,
            userId,
            orderRef: hasOrderRef ? orderRef : null,
            status: "Filled",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            secType: exec.secType ?? null,
            right: normalizedRight,
            strike: typeof exec.strike === 'number' && exec.strike > 0 ? exec.strike : null,
            expiration: exec.expiration ?? null,
            multiplier: exec.multiplier || multiplier,
            localSymbol: exec.localSymbol ?? null,
            conId: exec.conId ?? null,
            raw: stripUndefined(exec as unknown as Record<string, unknown>)
        });
        batch.set(tradeRef, payload);
        newFills++;
        batchCount++;

        if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    if (fallbackMismatch > 0) {
        logger.warn("Execution userId overrides due to orderRef mismatch", {
            fallbackMismatch,
            reassigned
        });
    } else if (reassigned > 0) {
        logger.info("Execution userId reassigned", { reassigned });
    }

    return { fills: newFills, fallbackUsed };
}
