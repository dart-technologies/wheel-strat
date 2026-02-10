import type { OptionLeg, QuoteResult } from "./liveMarketDataSelection";
import { selectOptionLegFromQuotes } from "./liveMarketDataSelection";
import { setCachedLiveSnapshot } from "./liveMarketDataCache";

type CandidateInfo = Map<string, { targetExp: string; candidates: number[]; currentPrice: number }>;

export const buildLiveResults = ({
    normalizedSymbols,
    marketDataMap,
    cachedBySymbol,
    cacheKeys,
    candidateInfo,
    quoteMap,
    targetWinProb,
    diagnosticsBySymbol,
    debug
}: {
    normalizedSymbols: string[];
    marketDataMap: Map<string, any>;
    cachedBySymbol: Map<string, any>;
    cacheKeys: Map<string, string>;
    candidateInfo: CandidateInfo;
    quoteMap: Map<string, QuoteResult>;
    targetWinProb: number;
    diagnosticsBySymbol?: Map<string, Record<string, unknown>> | null;
    debug?: boolean;
}) => {
    const results = [];
    for (const symbol of normalizedSymbols) {
        const attachDiagnostics = (payload: Record<string, unknown>) => {
            if (!debug) return payload;
            const diagnostics = {
                ...(diagnosticsBySymbol?.get(symbol) ?? { symbol }),
            };
            return { ...payload, diagnostics };
        };
        let quote = marketDataMap.get(symbol);
        if (!quote) {
            const cached = cachedBySymbol.get(symbol);
            if (cached) {
                results.push(attachDiagnostics({ ...cached, stale: true }));
            } else {
                results.push(attachDiagnostics({ symbol }));
            }
            continue;
        }

        const currentPrice = quote?.last || quote?.bid || quote?.close;
        if (!currentPrice) {
            const cached = cachedBySymbol.get(symbol);
            if (cached) {
                results.push(attachDiagnostics({ ...cached, stale: true }));
            } else {
                results.push(attachDiagnostics({ symbol }));
            }
            continue;
        }

        const callInfo = candidateInfo.get(`${symbol}|C`);
        const putInfo = candidateInfo.get(`${symbol}|P`);

        let ccResult: { leg: OptionLeg | null; reason?: string } = { leg: null, reason: "no-chain" };
        let cspResult: { leg: OptionLeg | null; reason?: string } = { leg: null, reason: "no-chain" };

        if (callInfo && callInfo.candidates.length) {
            const callQuotes = new Map<number, QuoteResult>();
            callInfo.candidates.forEach((strike) => {
                const key = `${symbol}|${callInfo.targetExp}|C|${strike}`;
                const quoteEntry = quoteMap.get(key);
                if (quoteEntry) callQuotes.set(strike, quoteEntry);
            });
            ccResult = selectOptionLegFromQuotes(symbol, currentPrice, targetWinProb, "C", callInfo.targetExp, callInfo.candidates, callQuotes);
        }

        if (putInfo && putInfo.candidates.length) {
            const putQuotes = new Map<number, QuoteResult>();
            putInfo.candidates.forEach((strike) => {
                const key = `${symbol}|${putInfo.targetExp}|P|${strike}`;
                const quoteEntry = quoteMap.get(key);
                if (quoteEntry) putQuotes.set(strike, quoteEntry);
            });
            cspResult = selectOptionLegFromQuotes(symbol, currentPrice, targetWinProb, "P", putInfo.targetExp, putInfo.candidates, putQuotes);
        }

        const baseSnapshot = { symbol, currentPrice, cc: ccResult.leg, csp: cspResult.leg };
        const snapshot = debug
            ? attachDiagnostics({
                ...baseSnapshot,
                ccReason: ccResult.reason,
                cspReason: cspResult.reason
            })
            : baseSnapshot;
        const cacheKey = cacheKeys.get(symbol);
        if (cacheKey) setCachedLiveSnapshot(cacheKey, baseSnapshot);
        results.push(snapshot);
    }

    return { results };
};
