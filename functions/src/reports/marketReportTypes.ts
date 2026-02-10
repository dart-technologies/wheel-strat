import { HistoricalContext } from "@/lib/historicalRepositoryTypes";

export interface ReportData {
    headline?: string;
    macroAnalysis: string;
    keyDates: Array<{
        date: string;
        event: string;
        impact: "high" | "medium" | "low";
        symbols?: string[];
    }>;
    vixLevel: number;
    marketBias: "bullish" | "bearish" | "neutral";
    synopsis?: string;
}

export interface YieldComparison {
    symbol: string;
    strategy: string;
    strike: number;
    expiration: string;
    premium: number;
    annualizedYield: number;
    winProb: number;
    ivRank: number;
    risk: string;
    reward: string;
    currentPrice?: number;
    history?: HistoricalContext; // NEW: Enriched Data
}
