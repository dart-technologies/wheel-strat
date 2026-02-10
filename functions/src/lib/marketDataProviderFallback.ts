import { HistoricalRepository } from "./historicalRepository";
import { DEFAULT_SYMBOLS } from "./marketDataProviderUtils";
import type { MarketDataProvider, MarketSnapshot } from "./marketDataProviderTypes";

export class HistoricalMarketDataProvider implements MarketDataProvider {
    private repo = new HistoricalRepository();
    constructor(private symbols = DEFAULT_SYMBOLS) { }

    async getMarketSnapshot(symbols = this.symbols): Promise<MarketSnapshot[]> {
        const context = await this.repo.getHistoricalContext(symbols);
        return symbols.map(symbol => {
            const history = context[symbol]?.priceHistory;
            const price = history?.[history.length - 1];
            return (price && !Number.isNaN(price)) ? { symbol, price } : null;
        }).filter((s): s is MarketSnapshot => s !== null);
    }

    async fetchIvRank() { return undefined; }
    async getOptionChain() { return null; }
}

export class MockMarketDataProvider implements MarketDataProvider {
    private market: MarketSnapshot[] = [
        { symbol: "NVDA", price: 186.51, ivRank: 65, sector: "Technology", earningsDate: "2026-02-15" },
        { symbol: "TSLA", price: 437.86, ivRank: 42, sector: "Automotive", earningsDate: "2026-01-25" },
        { symbol: "AAPL", price: 255.53, ivRank: 15, sector: "Technology" },
        { symbol: "MSFT", price: 459.86, ivRank: 30, sector: "Technology" },
        { symbol: "GOOGL", price: 333.00, ivRank: 55, sector: "Technology" },
        { symbol: "AMZN", price: 239.12, ivRank: 45, sector: "Consumer Cyclical" },
        { symbol: "META", price: 620.54, ivRank: 40, sector: "Technology" },
    ];

    async getMarketSnapshot(symbols?: string[]): Promise<MarketSnapshot[]> {
        if (!symbols) return this.market;
        return this.market.filter(m => symbols.includes(m.symbol));
    }
    async fetchIvRank() { return 40; }
    async getOptionChain() { return { expirations: ["20260220"], strikes: [150, 160, 170] }; }
}

export class UnconfiguredMarketDataProvider implements MarketDataProvider {
    async getMarketSnapshot(): Promise<MarketSnapshot[]> { return []; }
    async fetchIvRank() { return undefined; }
    async getOptionChain() { return null; }
}

export class FallbackMarketDataProvider implements MarketDataProvider {
    constructor(
        private primary: MarketDataProvider,
        private fallback: MarketDataProvider
    ) { }

    async getMarketSnapshot(symbols?: string[]): Promise<MarketSnapshot[]> {
        if (symbols && symbols.length === 0) return [];

        const expectedSymbols = symbols
            ? symbols.map((symbol) => symbol.toUpperCase())
            : DEFAULT_SYMBOLS.map((symbol) => symbol.toUpperCase());

        let primarySnapshots: MarketSnapshot[] = [];
        try {
            primarySnapshots = await this.primary.getMarketSnapshot(symbols);
        } catch (error) {
            console.warn("[marketDataProvider] Primary market snapshot failed, falling back:", error);
        }

        const merged = new Map<string, MarketSnapshot>();
        primarySnapshots.forEach((snapshot) => {
            if (!snapshot?.symbol) return;
            merged.set(snapshot.symbol.toUpperCase(), { ...snapshot, symbol: snapshot.symbol.toUpperCase() });
        });

        const missingSymbols = expectedSymbols.filter((symbol) => !merged.has(symbol));
        if (missingSymbols.length > 0) {
            try {
                const fallbackSnapshots = await this.fallback.getMarketSnapshot(missingSymbols);
                fallbackSnapshots.forEach((snapshot) => {
                    if (!snapshot?.symbol) return;
                    const normalized = snapshot.symbol.toUpperCase();
                    if (!merged.has(normalized)) {
                        merged.set(normalized, { ...snapshot, symbol: normalized });
                    }
                });
            } catch (error) {
                console.warn("[marketDataProvider] Fallback market snapshot failed:", error);
            }
        }

        const mergedSnapshots = Array.from(merged.values());
        await Promise.all(mergedSnapshots.map(async (snapshot) => {
            if (snapshot.ivRank !== undefined) return;
            if (!Number.isFinite(snapshot.price)) return;
            try {
                const ivRank = await this.fallback.fetchIvRank(snapshot.symbol, snapshot.price);
                if (ivRank !== undefined) snapshot.ivRank = ivRank;
            } catch (error) {
                console.warn("[marketDataProvider] Fallback IV rank failed:", error);
            }
        }));

        return mergedSnapshots;
    }

    async fetchIvRank(symbol: string, currentPrice: number): Promise<number | undefined> {
        try {
            const primary = await this.primary.fetchIvRank(symbol, currentPrice);
            if (primary !== undefined) return primary;
        } catch (error) {
            console.warn("[marketDataProvider] Primary IV rank failed, falling back:", error);
        }
        return this.fallback.fetchIvRank(symbol, currentPrice);
    }

    async getOptionChain(symbol: string): Promise<{ expirations: string[]; strikes: number[] } | null> {
        try {
            const primary = await this.primary.getOptionChain(symbol);
            if (primary?.expirations?.length && primary?.strikes?.length) return primary;
        } catch (error) {
            console.warn("[marketDataProvider] Primary option chain failed, falling back:", error);
        }
        return this.fallback.getOptionChain(symbol);
    }
}
