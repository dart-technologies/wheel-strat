export interface HistoricalContext {
    symbol: string;
    rsi_14: number | null;
    sma_20: number | null;
    sma_50: number | null;
    sma_200: number | null;
    priceHistory: number[]; // Last 30 closes for sparkline
    yearHigh: number | null;
    yearLow: number | null;
    avgVolume: number | null;
    source?: 'db' | 'fallback' | 'synthetic';
}

export type HistoricalBar = {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    average?: number;
};

export type HistoricalBarsResult = {
    symbol: string;
    bars: HistoricalBar[];
    source: 'db' | 'fallback';
};
