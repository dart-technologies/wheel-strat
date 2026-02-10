import type { FirestoreTimestampValue } from '../types/firestore';

/**
 * Shared Schema Definitions
 */

export type RiskLevel = 'Aggressive' | 'Moderate' | 'Conservative';
export type TraderLevel = 'Novice' | 'Intermediate' | 'Expert';
export type DteWindow = 'one_week' | 'two_weeks' | 'three_weeks' | 'four_weeks' | 'five_weeks';

export interface AnalysisSettings {
    riskLevel: RiskLevel;
    traderLevel: TraderLevel;
    dteWindow: DteWindow;
}


export interface Portfolio {
    cash: number;
    buyingPower: number;
    netLiq: number;
    dailyPnl?: number;
    dailyPnlPct?: number;
    realizedPnL?: number;
    unrealizedPnL?: number;
    excessLiquidity?: number;
    availableFunds?: number;
    portfolioDelta?: number;
    portfolioTheta?: number;
    betaWeightedDelta?: number;
    bpUsagePct?: number;
    vix?: number;
    [key: string]: string | number | boolean | undefined;
}

export interface Position {
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    closePrice?: number;
    costBasis?: number;
    marketValue?: number;
    dailyPnl?: number;
    dailyPnlPct?: number;
    ivRank?: number;
    rsi?: number;
    beta?: number;
    delta?: number;
    theta?: number;
    gamma?: number;
    vega?: number;
    companyName?: string;
    ccYield?: number;
    ccPremium?: number;
    ccPremiumSource?: string;
    ccStrike?: number;
    ccExpiration?: string;
    ccWinProb?: number;
    ccDelta?: number;
    ccGamma?: number;
    ccTheta?: number;
    ccVega?: number;
    cspYield?: number;
    cspPremium?: number;
    cspPremiumSource?: string;
    cspStrike?: number;
    cspExpiration?: string;
    cspWinProb?: number;
    cspDelta?: number;
    cspGamma?: number;
    cspTheta?: number;
    cspVega?: number;
    [key: string]: string | number | boolean | undefined;
}

export interface OptionPosition {
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice?: number;
    closePrice?: number;
    costBasis?: number;
    marketValue?: number;
    dailyPnl?: number;
    dailyPnlPct?: number;
    right?: string;
    strike?: number;
    expiration?: string;
    multiplier?: number;
    secType?: string;
    localSymbol?: string;
    conId?: number;
    companyName?: string;
    [key: string]: string | number | boolean | undefined;
}

export interface WatchlistItem {
    symbol: string;
    name: string;
    [key: string]: string | number | boolean | undefined;
}

export interface OpportunityScenario {
    probability: number | string;
    description: string;
    target?: number | string;
    downside?: number | string;
    range?: [number, number] | string;
}

export interface OpportunityTechnicalLevel {
    level: number | string;
    type?: string;
    strength?: string;
}

export interface OpportunityTechnicals {
    support?: OpportunityTechnicalLevel[] | OpportunityTechnicalLevel | string;
    resistance?: OpportunityTechnicalLevel[] | OpportunityTechnicalLevel | string;
    rsi?: number | string;
    trend?: string;
    pattern?: string | { pattern: string };
}

export interface OpportunityCatalyst {
    event?: string;
    date?: string;
    impact?: 'high' | 'medium' | 'low' | string;
}

export interface OpportunityMetrics {
    yearLow?: number;
    yearHigh?: number;
}

export interface OpportunityContext {
    historicalWinRate?: number;
    historicalMatches?: number;
    regimeProbability?: number;
    ivRankGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
    premiumRichness?: 'Cheap' | 'Fair' | 'Expensive';
    sustainableYield?: number;
}

export interface OpportunityAnalysis {
    scenarios?: {
        bull?: OpportunityScenario;
        bear?: OpportunityScenario;
        sideways?: OpportunityScenario;
    };
    technicals?: OpportunityTechnicals;
    catalysts?: OpportunityCatalyst[] | { earnings?: string; events?: string[] };
    risks?: string[];
    verdict?: string;
    confidence?: number;
    metrics?: OpportunityMetrics;
    currentPrice?: number;
}

export interface Opportunity {
    symbol: string;
    description?: string;
    strategy: "Covered Call" | "Cash-Secured Put" | string;
    strike: number;
    expiration: string;
    premium: number;
    winProb: number;
    ivRank: number;
    annualizedYield?: number;
    currentPrice?: number;
    reasoning: string;
    priority?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    impliedVol?: number;
    createdAt?: FirestoreTimestampValue | string;
    analysis?: OpportunityAnalysis;
    context?: OpportunityContext;
    deepDive?: {
        backtest?: {
            winRate: number;
            maxLoss: number;
        };
        analysis?: string;
        plLabels?: string[];
        plData?: string[];
        generatedAt?: any;
    };
}

export interface TradeInput {
    symbol: string;
    quantity: number;
    price: number;
    type?: Trade['type'];
}

export interface ScanPosition {
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
}

export type OpportunityOrderBy = 'createdAt' | 'priority';

export interface OpportunityListenerOptions {
    orderByField?: OpportunityOrderBy;
    direction?: 'asc' | 'desc';
    limitCount?: number;
}

export interface Trade {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL' | 'CC' | 'CSP';
    quantity: number;
    price: number;
    date: string;
    total: number;
    commission?: number;
    entryIvRank?: number;
    entryVix?: number;
    entryDelta?: number;
    entryTheta?: number;
    entryRsi?: number;
    entryBeta?: number;
    userId?: string;
    efficiencyGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
    entryQuality?: number;
    status?: 'Pending' | 'Filled' | 'Cancelled';
    secType?: string;
    right?: string;
    strike?: number;
    expiration?: string;
    multiplier?: number;
    localSymbol?: string;
    conId?: number;
    raw?: Record<string, unknown>;
    [key: string]: string | number | boolean | Record<string, unknown> | undefined;
}

export interface LeaderboardEntry {
    userId: string;
    displayName: string;
    yieldPct: number;
    tradeCount: number;
}

export interface LeaderboardResponse {
    updatedAt: string;
    leaderboard: LeaderboardEntry[];
}

export interface ExplainTradeRequest {
    symbol: string;
    strategy: string;
    strike: number;
    expiration: string;
    premium: number;
    traderLevel?: TraderLevel;
    now?: string;
    forceRefresh?: boolean;
}

export interface ExplainTradeResponse {
    explanation: string;
    generatedAt?: string;
    cached?: boolean;
    cacheAge?: number;
}

export interface AgentAlert {
    symbol: string;
    price: number;
    ivRank: number;
    sector: string;
    recommendation: string;
    confidence: number;
    reasoning: string;
    status: 'new' | 'viewed' | 'dismissed';
    createdAt: FirestoreTimestampValue | string | any;
}

export interface ReportData {
    id: string;
    session: "open" | "close";
    date: string;
    headline?: string;
    macroAnalysis: string;
    synopsis?: string;
    keyDates: Array<{
        date: string;
        event: string;
        impact: "high" | "medium" | "low";
        symbols?: string[];
    }>;
    vixLevel: number;
    marketBias: "bullish" | "bearish" | "neutral";
    yieldComparison: Array<{
        symbol: string;
        strategy: string;
        strike: number;
        expiration: string;
        annualizedYield: number;
        winProb: number;
    }>;
    reportUrl?: string;
}

export interface EquityCurveEntry {
    id: string;
    date: string;
    netLiq: number;
    createdAt?: FirestoreTimestampValue | string;
}

export interface PredictionHistoryEntry {
    id: string;
    symbol: string;
    strategy?: string;
    strike?: number;
    expiration?: string;
    verdict?: string;
    target?: number;
    outcome?: 'win' | 'loss' | 'neutral' | string;
    ivRank?: number;
    rsi?: number;
    volatility?: number;
    evaluatedAt?: FirestoreTimestampValue | string;
    createdAt?: FirestoreTimestampValue | string;
    success?: boolean;
}

export interface CorporateAction {
    id: string;
    symbol: string;
    type: 'split' | 'dividend' | string;
    ratio?: number;
    exDate?: string;
    effectiveDate?: string;
    source?: string;
    processedAt?: FirestoreTimestampValue | string;
}

export interface MarketCalendarEntry {
    id: string;
    date: string;
    market?: string;
    isOpen?: boolean;
    holiday?: string;
    event?: string;
    earlyClose?: boolean;
    impact?: 'high' | 'medium' | 'low' | string;
    symbols?: string[] | string;
    updatedAt?: FirestoreTimestampValue | string;
    source?: string;
}

export interface MarketCacheEntry {
    id: string;
    key: string;
    tier: 'hot' | 'warm' | 'cold' | string;
    payload: string;
    updatedAt?: FirestoreTimestampValue | string;
    expiresAt?: FirestoreTimestampValue | string;
    source?: string;
    symbol?: string;
    category?: string;
}
