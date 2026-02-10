import { fetchWithTimeout } from "./fetch";
import {
    ibkrMarketQuoteSchema,
    ibkrOptionChainSchema,
    ibkrOptionQuoteSchema,
    parseIbkrResponse
} from "./ibkrSchemas";
import {
    CONCURRENCY_LIMIT,
    DEFAULT_SYMBOLS,
    LOG_INFO_ENABLED,
    fetchMarketDataBatch,
    getCached,
    parallelLimit,
    pickExpiration,
    pickStrike,
    setCache
} from "./marketDataProviderUtils";
import type { MarketDataProvider, MarketSnapshot } from "./marketDataProviderTypes";

export class IbkrMarketDataProvider implements MarketDataProvider {
    constructor(
        private bridgeUrl: string,
        private bridgeApiKey: string | undefined,
        private defaultSymbols = DEFAULT_SYMBOLS
    ) { }

    async getMarketSnapshot(symbols = this.defaultSymbols): Promise<MarketSnapshot[]> {
        if (LOG_INFO_ENABLED) {
            console.log(`🌐 [IbkrMarketDataProvider] Starting market snapshot for ${symbols.length} symbols.`);
        }
        const normalizedSymbols = symbols.map((symbol) => symbol.toUpperCase());
        const batchQuotes = await fetchMarketDataBatch(this.bridgeUrl, normalizedSymbols, this.bridgeApiKey);

        const snapshots = await parallelLimit(normalizedSymbols, CONCURRENCY_LIMIT, async (symbol) => {
            try {
                const cacheKey = `quote:${symbol}`;
                let quote = getCached<{ last?: number; bid?: number; close?: number; source?: string }>(cacheKey);

                if (!quote) {
                    quote = batchQuotes?.get(symbol);
                    if (!quote) {
                        const res = await fetchWithTimeout(`${this.bridgeUrl}/market-data/${symbol}`, {}, 30000, this.bridgeApiKey);
                        if (!res.ok) return null;
                        const rawQuote = await res.json();
                        const parsedQuote = parseIbkrResponse(
                            ibkrMarketQuoteSchema,
                            rawQuote,
                            `market-data/${symbol}`
                        );
                        if (!parsedQuote) return null;
                        quote = parsedQuote;
                    }
                    if (quote) setCache(cacheKey, quote);
                }

                const price = quote?.last || quote?.bid || quote?.close;
                if (!price) return null;

                const ivInfo = await this.fetchIvRankInfo(symbol, price);
                return {
                    symbol,
                    price,
                    ivRank: ivInfo.ivRank,
                    rawIv: ivInfo.rawIv,
                    source: quote?.source
                } as MarketSnapshot;
            } catch (error) {
                console.error(`❌ [IbkrMarketDataProvider] Snapshot failed for ${symbol}:`, error);
                return null;
            }
        });

        const results = snapshots.filter((s): s is MarketSnapshot => s !== null);
        if (LOG_INFO_ENABLED) {
            console.log(`📊 [IbkrMarketDataProvider] Snapshot complete. Found ${results.length}/${symbols.length} symbols.`);
        }
        return results;
    }

    async getOptionChain(symbol: string): Promise<{ expirations: string[]; strikes: number[] } | null> {
        const cacheKey = `chain:${symbol}`;
        let chain = getCached<{ expirations: string[]; strikes: number[] }>(cacheKey);
        if (chain) return chain;

        try {
            const res = await fetchWithTimeout(`${this.bridgeUrl}/option-chain/${symbol}`, {}, 30000, this.bridgeApiKey);
            if (!res.ok) return null;
            const rawChain = await res.json();
            const parsedChain = parseIbkrResponse(ibkrOptionChainSchema, rawChain, `option-chain/${symbol}`);
            if (!parsedChain?.expirations?.length || !parsedChain?.strikes?.length) return null;
            chain = { expirations: parsedChain.expirations, strikes: parsedChain.strikes };
            if (chain) setCache(cacheKey, chain, 10 * 60 * 1000); // Chains can be cached longer (10 mins)
            return chain || null;
        } catch (error) {
            console.error(`❌ [IbkrMarketDataProvider] Option chain failed for ${symbol}:`, error);
            return null;
        }
    }

    async fetchIvRank(symbol: string, currentPrice: number): Promise<number | undefined> {
        const info = await this.fetchIvRankInfo(symbol, currentPrice);
        return info.ivRank;
    }

    private async fetchIvRankInfo(symbol: string, currentPrice: number): Promise<{ ivRank?: number; rawIv?: number }> {
        const cacheKey = `ivRankInfo:${symbol}:${Math.round(currentPrice)}`;
        const cached = getCached<{ ivRank?: number; rawIv?: number }>(cacheKey);
        if (cached) return cached;

        try {
            const chain = await this.getOptionChain(symbol);
            if (!chain || !chain.strikes.length) return {};

            const expiration = pickExpiration(chain.expirations);
            const strike = pickStrike(chain.strikes, currentPrice);

            const quoteRes = await fetchWithTimeout(`${this.bridgeUrl}/option-quote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol, strike, expiration, right: "C" })
            }, 30000, this.bridgeApiKey);

            if (!quoteRes.ok) return {};
            const rawQuote = await quoteRes.json();
            const quote = parseIbkrResponse(ibkrOptionQuoteSchema, rawQuote, `option-quote/${symbol}`);
            if (!quote || typeof quote.impliedVol !== "number") return {};

            const rawIv = quote.impliedVol;
            // SCALE: ivRank = rawIv * 100 for now as a placeholder until true percentile is merged from backtestPipeline
            const ivRank = Math.round(Math.min(1, Math.max(0, rawIv)) * 100);

            const info = { ivRank, rawIv };
            setCache(cacheKey, info);
            return info;
        } catch (error) {
            console.warn(`❌ [IbkrMarketDataProvider] IV lookup failed for ${symbol}:`, error);
            return {};
        }
    }
}
