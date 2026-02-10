export type MarketSnapshot = {
    symbol: string;
    price: number;
    ivRank?: number; // 0-100 percentile
    rawIv?: number;  // 0.0-1.0
    realizedVol?: number;
    sector?: string;
    support?: number;
    resistance?: number;
    earningsDate?: string; // YYYY-MM-DD
    source?: string;
};

export interface MarketDataProvider {
    getMarketSnapshot: (symbols?: string[]) => Promise<MarketSnapshot[]>;
    fetchIvRank: (symbol: string, currentPrice: number) => Promise<number | undefined>;
    getOptionChain: (symbol: string) => Promise<{ expirations: string[]; strikes: number[] } | null>;
}

export type MarketDataMode = "live" | "mock" | "historical" | "public" | "ibkr";

export type OptionQuote = {
    bid?: number;
    ask?: number;
    last?: number;
    close?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    modelOptPrice?: number;
    impliedVol?: number;
    premium?: number;
    premiumSource?: "mid" | "bid" | "ask" | "last" | "model";
    reason?: string;
    meta?: {
        bid?: number;
        ask?: number;
        last?: number;
        modelOptPrice?: number;
    };
};
