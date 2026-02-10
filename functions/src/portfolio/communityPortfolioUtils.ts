export type BridgePosition = {
    account?: string;
    symbol?: string;
    quantity?: number | string;
    avgCost?: number | string;
    secType?: string;
    right?: string;
    strike?: number | string;
    expiration?: string;
    localSymbol?: string;
    conId?: number | string;
    multiplier?: number | string;
    marketPrice?: number | string;
    marketValue?: number | string;
    realizedPnl?: number | string;
    unrealizedPnl?: number | string;
};

export type NormalizedPosition = {
    account?: string;
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketPrice?: number;
    marketValue?: number;
    secType?: string;
    right?: string;
    strike?: number;
    expiration?: string;
    localSymbol?: string;
    conId?: number;
    multiplier?: number;
    realizedPnl?: number;
    unrealizedPnl?: number;
};

export const toNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const stripUndefined = <T extends Record<string, unknown>>(value: T): T => {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => {
            if (entry === undefined) return false;
            return !(typeof entry === 'number' && !Number.isFinite(entry));
        })
    ) as T;
};

export const normalizePosition = (raw: BridgePosition): NormalizedPosition | null => {
    const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim().toUpperCase() : '';
    if (!symbol) return null;

    const quantityValue = toNumber(raw.quantity);
    if (!Number.isFinite(quantityValue) || (quantityValue as number) === 0) return null;
    const quantity = quantityValue as number;

    const secType = typeof raw.secType === 'string' ? raw.secType.trim().toUpperCase() : undefined;
    const right = typeof raw.right === 'string' ? raw.right.trim().toUpperCase() : undefined;
    const strike = toNumber(raw.strike);
    const multiplier = toNumber(raw.multiplier);

    const hasOptionData = secType === 'OPT'
        || Boolean(right)
        || Boolean(raw.expiration)
        || (Number.isFinite(strike) && (strike as number) > 0);

    // For options, IBKR sends avgCost as TOTAL cost per contract, not per-share
    // For stocks, avgCost is per-share
    const rawAvgCost = toNumber(raw.avgCost) ?? 0;
    const avgCost = hasOptionData && multiplier
        ? rawAvgCost / (multiplier as number)  // Convert to per-share for options
        : rawAvgCost;

    const marketPrice = toNumber(raw.marketPrice);
    const currentPrice = Number.isFinite(marketPrice) ? (marketPrice as number) : avgCost;

    const rawMarketValue = toNumber(raw.marketValue);
    let marketValue = rawMarketValue;
    if (marketValue === undefined && Number.isFinite(currentPrice)) {
        if (!hasOptionData) {
            marketValue = quantity * (currentPrice as number);
        } else if (Number.isFinite(multiplier)) {
            marketValue = quantity * (currentPrice as number) * (multiplier as number);
        }
    }

    return {
        account: raw.account,
        symbol,
        quantity,
        averageCost: avgCost,
        currentPrice,
        marketPrice: toNumber(raw.marketPrice),
        marketValue,
        secType: secType ?? raw.secType,
        right: hasOptionData ? right : undefined,
        strike: hasOptionData && Number.isFinite(strike) && (strike as number) > 0 ? (strike as number) : undefined,
        expiration: hasOptionData ? raw.expiration : undefined,
        localSymbol: raw.localSymbol,
        conId: toNumber(raw.conId),
        multiplier: hasOptionData ? multiplier : undefined,
        realizedPnl: toNumber(raw.realizedPnl),
        unrealizedPnl: toNumber(raw.unrealizedPnl)
    };
};

export const buildPositionId = (position: NormalizedPosition | null) => {
    if (!position) return null;
    const secType = (position.secType || '').toUpperCase();
    if (secType === 'OPT' || position.right || position.strike || position.expiration) {
        if (position.conId) return `opt_${position.conId}`;
        if (position.localSymbol) return `opt_${position.localSymbol}`;
        return `opt_${position.symbol}_${position.right || 'X'}_${position.strike ?? 0}_${position.expiration || 'na'}`;
    }
    return `stk_${position.symbol}`;
};

export const normalizeAccountSummary = (raw: Record<string, unknown> | null) => {
    const cash = toNumber(raw?.TotalCashValue) ?? 0;
    const netLiq = toNumber(raw?.NetLiquidation) ?? cash;
    const buyingPower = toNumber(raw?.BuyingPower)
        ?? toNumber(raw?.AvailableFunds)
        ?? toNumber(raw?.ExcessLiquidity)
        ?? cash;
    return { cash, netLiq, buyingPower };
};
