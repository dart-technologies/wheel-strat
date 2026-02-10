import type { Cell, MapCell, Row } from 'tinybase';

export type MarketRefreshOptions = {
    orderByField?: 'createdAt' | 'priority';
    direction?: 'asc' | 'desc';
    limitCount?: number;
};

export type MarketSnapshot = {
    updatedSymbols: string[];
    netLiq: number;
    dailyPnl?: number;
    dailyPnlPct?: number;
    excessLiquidity?: number;
    availableFunds?: number;
    portfolioDelta?: number;
    portfolioTheta?: number;
    betaWeightedDelta?: number;
    bpUsagePct?: number;
    vix?: number;
};

export type LiveOptionLeg = {
    strike: number;
    expiration: string;
    premium: number;
    annualizedYield: number;
    premiumSource?: 'mid' | 'bid' | 'ask' | 'last' | 'model';
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    winProb?: number;
};

export type LiveOptionSnapshot = {
    symbol: string;
    currentPrice?: number;
    cc?: LiveOptionLeg | null;
    csp?: LiveOptionLeg | null;
};

export type MarketDataStore = {
    getRow: (tableId: string, rowId: string) => Row;
    setRow: (tableId: string, rowId: string, row: Row) => void;
    setCell: (tableId: string, rowId: string, cellId: string, cell: Cell | MapCell) => void;
    delCell: (tableId: string, rowId: string, cellId: string, forceDel?: boolean) => void;
    getTable: (tableId: string) => Record<string, Row>;
    transaction: (actions: () => void) => void;
};
