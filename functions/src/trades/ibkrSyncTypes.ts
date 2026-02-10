export interface IBKRExecution {
    execId: string;
    time: string;
    symbol: string;
    secType: string;
    side: 'BOT' | 'SLD';
    shares: number;
    price: number;
    avgPrice: number;
    commission?: number;
    orderRef: string; // Firebase UID
    cumQty?: number;
    strike?: number;
    right?: string;
    expiration?: string;
    localSymbol?: string;
    conId?: number;
    multiplier?: number;
}

export interface IBKROrder {
    orderId?: number;
    permId?: number;
    status?: string;
    action?: 'BUY' | 'SELL';
    totalQuantity?: number;
    remaining?: number;
    filled?: number;
    avgFillPrice?: number;
    orderType?: string;
    lmtPrice?: number;
    auxPrice?: number;
    initMarginChange?: number;
    tif?: string;
    account?: string;
    orderRef?: string;
    symbol?: string;
    secType?: string;
    right?: string;
    strike?: number;
    expiration?: string;
    localSymbol?: string;
    conId?: number;
    multiplier?: number;
    currency?: string;
    exchange?: string;
}
