import {
    fetchPublicEquityQuotes,
    fetchPublicOptionChain,
    fetchPublicOptionExpirations,
    getPublicMarketConfig
} from "./publicMarketData";
import { DEFAULT_SYMBOLS, getCached, setCache } from "./marketDataProviderUtils";
import type { MarketDataProvider, MarketSnapshot } from "./marketDataProviderTypes";

export class PublicMarketDataProvider implements MarketDataProvider {
    constructor(
        private config: ReturnType<typeof getPublicMarketConfig>,
        private defaultSymbols = DEFAULT_SYMBOLS
    ) { }

    async getMarketSnapshot(symbols = this.defaultSymbols): Promise<MarketSnapshot[]> {
        const quotes = await fetchPublicEquityQuotes(symbols, this.config);
        if (!quotes || quotes.size === 0) return [];

        const results: MarketSnapshot[] = [];
        symbols.forEach((symbol) => {
            const quote = quotes.get(symbol.toUpperCase());
            const price = quote?.last || quote?.bid || quote?.close;
            if (!price) return;
            results.push({ symbol: symbol.toUpperCase(), price, source: "public" });
        });
        return results;
    }

    async getOptionChain(symbol: string): Promise<{ expirations: string[]; strikes: number[] } | null> {
        const cacheKey = `public:chain:${symbol}`;
        let chain = getCached<{ expirations: string[]; strikes: number[] }>(cacheKey);
        if (chain) return chain;

        const normalizedSymbol = symbol.toUpperCase();
        const expirations = await fetchPublicOptionExpirations(normalizedSymbol, this.config);
        if (!expirations.length) return null;
        const payload = await fetchPublicOptionChain(normalizedSymbol, this.config, expirations[0]);
        if (!payload) return null;
        chain = { expirations: payload.expirations, strikes: payload.strikes };
        setCache(cacheKey, chain, 10 * 60 * 1000);
        return chain;
    }

    async fetchIvRank(): Promise<number | undefined> {
        return undefined;
    }
}
