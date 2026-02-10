import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { DEFAULT_DTE_WINDOW, getTargetWinProb } from "@wheel-strat/shared";
import {
    fetchPublicOptionGreeks,
    getPublicMarketConfig,
    PUBLIC_API_SECRET,
} from "@/lib/publicMarketData";
import type { PublicOptionQuote } from "@/lib/publicMarketData";
import { chunkArray, resolveDteRange } from "./liveMarketDataUtils";
import {
    buildLiveCacheKey,
    getCachedLiveSnapshot
} from "./liveMarketDataCache";
import {
    type DeltaCandidateResult,
    type QuoteResult,
    buildStrikeCandidates,
    fetchIbkrHistoricalOptionQuote,
    hasQuotePrice,
    normalizeQuote,
    pickExpiration,
    pickStrike,
    selectDeltaCandidates
} from "./liveMarketDataSelection";
import { loadPublicMarketData } from "./liveMarketDataPublic";
import {
    createIbkrHealthGuard,
    fetchIbkrMarketDataBatch,
    fetchIbkrMarketDataSingle,
    fetchIbkrOptionChainBatch,
    fetchIbkrOptionChainSingle,
    fetchIbkrOptionQuotesBatch
} from "./liveMarketDataIbkr";
import { buildLiveResults } from "./liveMarketDataResults";

export const refreshLiveOptions = onCall({
    timeoutSeconds: 180,
    memory: "512MiB",
    secrets: [PUBLIC_API_SECRET]
}, async (request) => {
    const data = request.data;
    const debug = Boolean(data?.debug);
    const diagnosticsBySymbol = debug ? new Map<string, Record<string, unknown>>() : null;
    const recordDiagnostic = (symbol: string, patch: Record<string, unknown>) => {
        if (!diagnosticsBySymbol) return;
        const current = diagnosticsBySymbol.get(symbol) ?? { symbol };
        diagnosticsBySymbol.set(symbol, { ...current, ...patch });
    };
    try {
        const publicConfig = getPublicMarketConfig();
        const providerPref = (process.env.MARKET_DATA_PROVIDER || '').trim().toLowerCase();
        const preferPublic = providerPref === 'public' || providerPref === '';
        const usePublic = preferPublic && publicConfig.configured;
        const useIbkrPrimary = !usePublic;
        const skipGreeks = Boolean(data?.skipGreeks)
            || (process.env.MARKET_DATA_SKIP_GREEKS || '').toLowerCase() === 'true';
        const providerLabel = providerPref || (usePublic ? 'public' : 'ibkr');
        console.log(`[liveMarketData] provider=${providerLabel} publicConfigured=${publicConfig.configured} usePublic=${usePublic} skipGreeks=${skipGreeks}`);
        const { bridgeUrl, bridgeApiKey, tradingMode, bridgeUrlConfigured } = requireIbkrBridge({ requireConfigured: useIbkrPrimary });
        const symbols: string[] = Array.isArray(data?.symbols)
            ? data.symbols
                .map((rawSymbol: unknown) => String(rawSymbol).toUpperCase().trim())
                .filter((symbol: string) => symbol.length > 0)
            : [];

        // Map Risk Level to Win Prob
        let targetWinProb = getTargetWinProb(data?.riskLevel);
        if (typeof data?.targetWinProb === 'number') {
            targetWinProb = data.targetWinProb;
        }

        const dteRange = resolveDteRange(data?.dteWindow);

        if (symbols.length === 0) {
            return { results: [] };
        }

        if (preferPublic && !publicConfig.configured) {
            const context = providerPref ? `MARKET_DATA_PROVIDER=${providerPref}` : 'default provider';
            console.warn(`[liveMarketData] Public credentials missing; using IBKR fallback (${context}).`);
        }

        const resolvedBridgeUrl = bridgeUrl;
        console.log('[liveMarketData] dte-range', {
            dteWindow: data?.dteWindow ?? DEFAULT_DTE_WINDOW,
            minDays: dteRange.minDays,
            maxDays: dteRange.maxDays
        });
        if (usePublic) {
            console.log(`[liveMarketData] Using Public market data for ${symbols.length} symbols (fallback IBKR: ${bridgeUrlConfigured ? 'on' : 'off'})`);
        } else {
            console.log(`[liveMarketData] Using Bridge URL: ${resolvedBridgeUrl} for ${symbols.length} symbols (mode: ${tradingMode})`);
        }

        const { ensureIbkrHealthy, getHealthError } = createIbkrHealthGuard(
            resolvedBridgeUrl,
            bridgeApiKey,
            bridgeUrlConfigured
        );

        if (useIbkrPrimary) {
            const ok = await ensureIbkrHealthy();
            if (!ok) {
                throw getHealthError() ?? new HttpsError(
                    "unavailable",
                    `Cannot reach IBKR Bridge server at ${resolvedBridgeUrl}`
                );
            }
        }

        const normalizedSymbols: string[] = Array.from(new Set(symbols));
        const cachedBySymbol = new Map<string, any>();
        const cacheKeys = new Map<string, string>();

        for (const symbol of normalizedSymbols) {
            const key = buildLiveCacheKey(symbol, targetWinProb, dteRange);
            cacheKeys.set(symbol, key);
            const cached = getCachedLiveSnapshot(key);
            if (cached) cachedBySymbol.set(symbol, cached);
            recordDiagnostic(symbol, {
                provider: providerLabel,
                usePublic,
                bridgeConfigured: bridgeUrlConfigured,
                tradingMode
            });
        }

        let marketDataMap = new Map<string, any>();
        let optionChainMap = new Map<string, any>();
        let quoteMap = new Map<string, QuoteResult>();
        let publicOsiMap = new Map<string, string>();
        let publicGreeksCache = new Map<string, PublicOptionQuote>();

        if (usePublic) {
            const publicStart = Date.now();
            const publicLoad = await loadPublicMarketData(normalizedSymbols, dteRange, publicConfig);
            const publicDuration = Date.now() - publicStart;
            if (publicDuration >= 2000) {
                console.log('[liveMarketData] Public load duration', {
                    durationMs: publicDuration,
                    symbols: normalizedSymbols.length
                });
            }
            marketDataMap = publicLoad.marketDataMap;
            optionChainMap = publicLoad.optionChainMap;
            quoteMap = publicLoad.quoteMap;
            publicOsiMap = publicLoad.publicOsiMap;
            publicGreeksCache = publicLoad.publicGreeksCache;
        }

        const missingMarketSymbols = normalizedSymbols.filter((symbol) => !marketDataMap.has(symbol));
        const missingChainSymbols = normalizedSymbols.filter((symbol) => !optionChainMap.has(symbol));

        if (missingMarketSymbols.length || missingChainSymbols.length) {
            const ibkrReady = useIbkrPrimary || (bridgeUrlConfigured && await ensureIbkrHealthy());
            if (ibkrReady) {
                try {
                    if (missingMarketSymbols.length) {
                        const results = await fetchIbkrMarketDataBatch(bridgeUrl, bridgeApiKey, missingMarketSymbols);
                        results.forEach((item) => {
                            if (item?.symbol) marketDataMap.set(String(item.symbol).toUpperCase(), item);
                        });
                    }
                } catch (error) {
                    console.warn('[liveMarketData] Batch market-data failed:', error);
                }

                try {
                    if (missingChainSymbols.length) {
                        const results = await fetchIbkrOptionChainBatch(bridgeUrl, bridgeApiKey, missingChainSymbols);
                        results.forEach((item) => {
                            if (item?.symbol) optionChainMap.set(String(item.symbol).toUpperCase(), item);
                        });
                    }
                } catch (error) {
                    console.warn('[liveMarketData] Batch option-chain failed:', error);
                }
            } else if (usePublic) {
                console.warn('[liveMarketData] IBKR fallback unavailable; continuing with Public-only data.');
            }
        }

        const optionRequests: Array<{ symbol: string; strike: number; expiration: string; right: 'C' | 'P' }> = [];
        const candidateInfo = new Map<string, { targetExp: string; candidates: number[]; currentPrice: number }>();
        const requestKeys = new Set<string>();

        for (const symbol of normalizedSymbols) {
            let quote = marketDataMap.get(symbol);
            if (!quote) {
                const ibkrReady = useIbkrPrimary || (bridgeUrlConfigured && await ensureIbkrHealthy());
                if (ibkrReady) {
                    try {
                        const parsedQuote = await fetchIbkrMarketDataSingle(bridgeUrl, bridgeApiKey, symbol);
                        if (parsedQuote) quote = parsedQuote;
                    } catch (error) {
                        console.warn(`[liveMarketData] market-data fallback failed for ${symbol}:`, error);
                    }
                }
            }

            const currentPrice = quote?.last || quote?.bid || quote?.close;
            if (!currentPrice) {
                recordDiagnostic(symbol, {
                    marketData: quote ? 'missing-price' : 'missing-quote'
                });
                continue;
            }
            if (quote) marketDataMap.set(symbol, quote);
            recordDiagnostic(symbol, {
                marketData: 'ok',
                currentPrice
            });

            let chain = optionChainMap.get(symbol);
            if (!chain) {
                const ibkrReady = useIbkrPrimary || (bridgeUrlConfigured && await ensureIbkrHealthy());
                if (ibkrReady) {
                    try {
                        const parsedChain = await fetchIbkrOptionChainSingle(bridgeUrl, bridgeApiKey, symbol);
                        if (parsedChain) chain = parsedChain;
                    } catch (error) {
                        console.warn(`[liveMarketData] option-chain fallback failed for ${symbol}:`, error);
                    }
                }
            }

            if (!chain || !Array.isArray(chain.expirations) || !Array.isArray(chain.strikes)) {
                recordDiagnostic(symbol, {
                    optionChain: chain ? 'invalid' : 'missing',
                    expirations: Array.isArray(chain?.expirations) ? chain.expirations.length : 0,
                    strikes: Array.isArray(chain?.strikes) ? chain.strikes.length : 0
                });
                continue;
            }
            optionChainMap.set(symbol, chain);

            const targetExp = pickExpiration(chain.expirations, dteRange);
            if (!targetExp) {
                recordDiagnostic(symbol, { optionChain: 'no-target-exp' });
                continue;
            }

            const callStrike = pickStrike(chain.strikes, currentPrice, 'C', targetWinProb);
            const putStrike = pickStrike(chain.strikes, currentPrice, 'P', targetWinProb);
            const targetDeltaAbs = 1 - (targetWinProb / 100);
            const callTargetDelta = targetDeltaAbs;
            const putTargetDelta = -targetDeltaAbs;

            let callCandidates: number[] = [];
            let putCandidates: number[] = [];
            let callDeltaInfo: DeltaCandidateResult | undefined;
            let putDeltaInfo: DeltaCandidateResult | undefined;

            if (usePublic && publicOsiMap.size > 0) {
                callDeltaInfo = await selectDeltaCandidates(
                    symbol,
                    targetExp,
                    'C',
                    callTargetDelta,
                    currentPrice,
                    publicOsiMap,
                    publicConfig,
                    publicGreeksCache
                );
                putDeltaInfo = await selectDeltaCandidates(
                    symbol,
                    targetExp,
                    'P',
                    putTargetDelta,
                    currentPrice,
                    publicOsiMap,
                    publicConfig,
                    publicGreeksCache
                );
                callCandidates = callDeltaInfo.strikes;
                putCandidates = putDeltaInfo.strikes;

                if (callDeltaInfo.bestDiff !== undefined && callDeltaInfo.bestDiff > 0.02) {
                    const expanded = await selectDeltaCandidates(
                        symbol,
                        targetExp,
                        'C',
                        callTargetDelta,
                        currentPrice,
                        publicOsiMap,
                        publicConfig,
                        publicGreeksCache,
                        24,
                        false
                    );
                    if (expanded.bestDiff !== undefined && callDeltaInfo.bestDiff !== undefined) {
                        if (expanded.bestDiff < callDeltaInfo.bestDiff) {
                            callDeltaInfo = expanded;
                            callCandidates = expanded.strikes;
                        }
                    } else if (expanded.strikes.length) {
                        callCandidates = expanded.strikes;
                    }
                }

                if (putDeltaInfo.bestDiff !== undefined && putDeltaInfo.bestDiff > 0.02) {
                    const expanded = await selectDeltaCandidates(
                        symbol,
                        targetExp,
                        'P',
                        putTargetDelta,
                        currentPrice,
                        publicOsiMap,
                        publicConfig,
                        publicGreeksCache,
                        24,
                        false
                    );
                    if (expanded.bestDiff !== undefined && putDeltaInfo.bestDiff !== undefined) {
                        if (expanded.bestDiff < putDeltaInfo.bestDiff) {
                            putDeltaInfo = expanded;
                            putCandidates = expanded.strikes;
                        }
                    } else if (expanded.strikes.length) {
                        putCandidates = expanded.strikes;
                    }
                }
            }

            if (callStrike !== null && callCandidates.length === 0) {
                callCandidates = buildStrikeCandidates(chain.strikes, currentPrice, 'C', targetWinProb, 6);
            }
            if (callCandidates.length) {
                candidateInfo.set(`${symbol}|C`, { targetExp, candidates: callCandidates, currentPrice });
                callCandidates.forEach((strike) => {
                    const key = `${symbol}|${targetExp}|C|${strike}`;
                    if (!requestKeys.has(key)) {
                        requestKeys.add(key);
                        optionRequests.push({ symbol, strike, expiration: targetExp, right: 'C' });
                    }
                });
            }

            if (putStrike !== null && putCandidates.length === 0) {
                putCandidates = buildStrikeCandidates(chain.strikes, currentPrice, 'P', targetWinProb, 6);
            }
            if (putCandidates.length) {
                candidateInfo.set(`${symbol}|P`, { targetExp, candidates: putCandidates, currentPrice });
                putCandidates.forEach((strike) => {
                    const key = `${symbol}|${targetExp}|P|${strike}`;
                    if (!requestKeys.has(key)) {
                        requestKeys.add(key);
                        optionRequests.push({ symbol, strike, expiration: targetExp, right: 'P' });
                    }
                });
            }

            recordDiagnostic(symbol, {
                optionChain: 'ok',
                targetExp,
                callCandidates: callCandidates.length,
                putCandidates: putCandidates.length
            });
        }

        if (usePublic && !skipGreeks && optionRequests.length > 0 && publicOsiMap.size > 0) {
            const osiToKeys = new Map<string, string[]>();
            optionRequests.forEach((req) => {
                const key = `${req.symbol}|${req.expiration}|${req.right}|${req.strike}`;
                const existing = quoteMap.get(key);
                if (!hasQuotePrice(existing) || existing?.delta !== undefined) return;
                const osi = publicOsiMap.get(key);
                if (!osi) return;
                const bucket = osiToKeys.get(osi) || [];
                bucket.push(key);
                osiToKeys.set(osi, bucket);
            });

            const osiSymbols = Array.from(osiToKeys.keys());
            const chunks = chunkArray(osiSymbols, 50);
            let mergedCount = 0;
            for (const chunk of chunks) {
                const greekStart = Date.now();
                const greekMap = await fetchPublicOptionGreeks(chunk, publicConfig);
                const greekDuration = Date.now() - greekStart;
                if (greekDuration >= 2000) {
                    console.log('[liveMarketData] Public greeks duration', {
                        durationMs: greekDuration,
                        symbols: chunk.length
                    });
                }
                if (!greekMap) continue;
                greekMap.forEach((greeks, osi) => {
                    publicGreeksCache.set(osi, greeks);
                    const keys = osiToKeys.get(osi);
                    if (!keys) return;
                    keys.forEach((key) => {
                        const existing = quoteMap.get(key) || {};
                        const merged: QuoteResult = { ...existing };
                        let updated = false;
                        if (merged.delta === undefined && greeks.delta !== undefined) {
                            merged.delta = greeks.delta;
                            updated = true;
                        }
                        if (merged.gamma === undefined && greeks.gamma !== undefined) {
                            merged.gamma = greeks.gamma;
                            updated = true;
                        }
                        if (merged.theta === undefined && greeks.theta !== undefined) {
                            merged.theta = greeks.theta;
                            updated = true;
                        }
                        if (merged.vega === undefined && greeks.vega !== undefined) {
                            merged.vega = greeks.vega;
                            updated = true;
                        }
                        quoteMap.set(key, normalizeQuote(merged));
                        if (updated) mergedCount += 1;
                    });
                });
            }
            console.log(`[liveMarketData] Public greeks merged: ${mergedCount}/${osiSymbols.length}`);
        } else if (usePublic && skipGreeks && optionRequests.length > 0 && publicOsiMap.size > 0) {
            console.log('[liveMarketData] Public greeks skipped by config', {
                requests: optionRequests.length,
                osiSymbols: publicOsiMap.size
            });
        }

        if (optionRequests.length > 0) {
            const missingRequests = optionRequests.filter((req) => {
                const key = `${req.symbol}|${req.expiration}|${req.right}|${req.strike}`;
                return !quoteMap.has(key);
            });

            if (missingRequests.length) {
                const ibkrReady = useIbkrPrimary || (bridgeUrlConfigured && await ensureIbkrHealthy());
                if (ibkrReady) {
                    try {
                        const results = await fetchIbkrOptionQuotesBatch(bridgeUrl, bridgeApiKey, missingRequests);
                        results.forEach((item) => {
                            if (!item?.symbol || !item?.expiration || !item?.right || item?.strike === undefined) return;
                            const key = `${String(item.symbol).toUpperCase()}|${item.expiration}|${item.right}|${item.strike}`;
                            quoteMap.set(key, normalizeQuote(item));
                        });
                    } catch (error) {
                        console.warn('[liveMarketData] Batch option-quote failed:', error);
                    }

                    const stillMissing = missingRequests.filter((req) => {
                        const key = `${req.symbol}|${req.expiration}|${req.right}|${req.strike}`;
                        return !hasQuotePrice(quoteMap.get(key));
                    });
                    if (stillMissing.length) {
                        for (const req of stillMissing) {
                            const hist = await fetchIbkrHistoricalOptionQuote(bridgeUrl, bridgeApiKey, req);
                            if (hist) {
                                const key = `${req.symbol}|${req.expiration}|${req.right}|${req.strike}`;
                                quoteMap.set(key, normalizeQuote(hist));
                            }
                        }
                    }
                } else if (usePublic) {
                    console.warn('[liveMarketData] IBKR option quote fallback unavailable; using Public-only quotes.');
                }
            }
        }

        if (diagnosticsBySymbol) {
            const requestCounts = new Map<string, { requested: number; resolved: number; priced: number }>();
            for (const req of optionRequests) {
                const entry = requestCounts.get(req.symbol) || { requested: 0, resolved: 0, priced: 0 };
                entry.requested += 1;
                const key = `${req.symbol}|${req.expiration}|${req.right}|${req.strike}`;
                const quote = quoteMap.get(key);
                if (quote) {
                    entry.resolved += 1;
                    if (hasQuotePrice(quote)) entry.priced += 1;
                }
                requestCounts.set(req.symbol, entry);
            }
            requestCounts.forEach((counts, symbol) => {
                recordDiagnostic(symbol, { quoteRequests: counts });
            });
        }

        return buildLiveResults({
            normalizedSymbols,
            marketDataMap,
            cachedBySymbol,
            cacheKeys,
            candidateInfo,
            quoteMap,
            targetWinProb,
            diagnosticsBySymbol,
            debug
        });
    } catch (error: any) {
        console.error("Critical error in refreshLiveOptions:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpsError("internal", `An internal error occurred during live market refresh: ${message}`, error);
    }
});
