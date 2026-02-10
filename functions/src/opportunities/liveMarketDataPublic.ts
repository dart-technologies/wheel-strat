import {
    buildPublicOptionOsiMap,
    buildPublicOptionQuoteMap,
    fetchPublicEquityQuotes,
    fetchPublicOptionChain,
    fetchPublicOptionExpirations,
    getPublicMarketConfig
} from "@/lib/publicMarketData";
import type { PublicOptionQuote } from "@/lib/publicMarketData";
import { formatExpiration } from "./liveMarketDataUtils";
import {
    type QuoteResult,
    normalizeQuote,
    pickExpiration
} from "./liveMarketDataSelection";

type PublicLoadResult = {
    marketDataMap: Map<string, any>;
    optionChainMap: Map<string, any>;
    quoteMap: Map<string, QuoteResult>;
    publicOsiMap: Map<string, string>;
    publicGreeksCache: Map<string, PublicOptionQuote>;
};

export const loadPublicMarketData = async (
    symbols: string[],
    dteRange: { minDays: number; maxDays: number },
    publicConfig: ReturnType<typeof getPublicMarketConfig>
): Promise<PublicLoadResult> => {
    const PUBLIC_CHAIN_CONCURRENCY = 7;
    const logThresholdMs = 2000;
    const logLatency = (label: string, durationMs: number, meta: Record<string, unknown>) => {
        if (durationMs < logThresholdMs) return;
        console.log(`[publicMarketData] ${label}`, { durationMs, ...meta });
    };
    const mapWithConcurrency = async <T, R>(
        items: T[],
        limit: number,
        mapper: (item: T, index: number) => Promise<R>
    ) => {
        if (items.length === 0) return [];
        const results: R[] = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
            while (true) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                if (currentIndex >= items.length) return;
                results[currentIndex] = await mapper(items[currentIndex], currentIndex);
            }
        });
        await Promise.all(workers);
        return results;
    };

    const marketDataMap = new Map<string, any>();
    const optionChainMap = new Map<string, any>();
    const quoteMap = new Map<string, QuoteResult>();
    const publicOsiMap = new Map<string, string>();
    const publicGreeksCache = new Map<string, PublicOptionQuote>();

    const quotesStart = Date.now();
    const publicQuotes = await fetchPublicEquityQuotes(symbols, publicConfig);
    logLatency('equity-quotes', Date.now() - quotesStart, { symbols: symbols.length });
    if (publicQuotes) {
        publicQuotes.forEach((quote, symbol) => {
            marketDataMap.set(symbol, { ...quote, source: "public" });
        });
    }

    await mapWithConcurrency(symbols, PUBLIC_CHAIN_CONCURRENCY, async (symbol) => {
        const expirationsStart = Date.now();
        const expirations = await fetchPublicOptionExpirations(symbol, publicConfig);
        logLatency('option-expirations', Date.now() - expirationsStart, {
            symbol,
            expirations: expirations.length
        });
        if (!expirations.length) return null;
        const targetExp = pickExpiration(expirations, dteRange);
        if (!targetExp) return null;
        const chainStart = Date.now();
        const chain = await fetchPublicOptionChain(symbol, publicConfig, formatExpiration(targetExp));
        logLatency('option-chain', Date.now() - chainStart, {
            symbol,
            expiration: targetExp,
            options: chain?.options?.length ?? 0
        });
        if (!chain) return null;
        optionChainMap.set(symbol, {
            expirations: [targetExp],
            strikes: chain.strikes,
            source: "public"
        });
        console.log(`[liveMarketData] Public chain ${symbol}: exp=${chain.expirations.length} strikes=${chain.strikes.length} options=${chain.options.length}`);
        if (chain.underlyingPrice && !marketDataMap.has(symbol)) {
            marketDataMap.set(symbol, { last: chain.underlyingPrice, source: "public" });
        }
        const publicQuoteMap = buildPublicOptionQuoteMap(chain);
        publicQuoteMap.forEach((quote, key) => {
            quoteMap.set(key, normalizeQuote(quote as QuoteResult));
        });
        const osiMap = buildPublicOptionOsiMap(chain);
        osiMap.forEach((osi, key) => {
            publicOsiMap.set(key, osi);
        });
        return null;
    });

    return {
        marketDataMap,
        optionChainMap,
        quoteMap,
        publicOsiMap,
        publicGreeksCache
    };
};
