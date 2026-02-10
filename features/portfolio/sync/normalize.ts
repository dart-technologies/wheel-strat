import { CommunityPosition } from './types';

export const toNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeSymbol = (value?: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : '';
};

export const isOptionPosition = (position: CommunityPosition) => {
    const secType = (position.secType || '').toUpperCase();
    if (secType === 'STK') return false;
    if (secType === 'OPT') return true;
    const strike = toNumber(position.strike);
    return Boolean(position.right)
        || Boolean(position.expiration)
        || (Number.isFinite(strike) && (strike as number) > 0);
};

export const buildOptionRowId = (position: CommunityPosition) => {
    if (position.id?.startsWith('opt_')) return position.id;
    const conId = toNumber(position.conId);
    if (conId) return `opt_${conId}`;
    const localSymbol = position.localSymbol?.trim();
    if (localSymbol) return `opt_${localSymbol}`;
    const symbol = normalizeSymbol(position.symbol);
    return symbol
        ? `opt_${symbol}_${position.right || 'X'}_${position.strike ?? 0}_${position.expiration || 'na'}`
        : null;
};

export const normalizePortfolio = (raw: Record<string, unknown>) => {
    const cash = toNumber(raw.cash) ?? 0;
    const netLiq = toNumber(raw.netLiq) ?? cash;
    const buyingPower = toNumber(raw.buyingPower) ?? cash;
    const availableFunds = toNumber(raw.availableFunds);
    const excessLiquidity = toNumber(raw.excessLiquidity);
    const dailyPnl = toNumber(raw.dailyPnl);
    const dailyPnlPct = toNumber(raw.dailyPnlPct);
    const realizedPnL = toNumber(raw.realizedPnL);
    const unrealizedPnL = toNumber(raw.unrealizedPnL);
    const portfolioDelta = toNumber(raw.portfolioDelta);
    const portfolioTheta = toNumber(raw.portfolioTheta);
    const betaWeightedDelta = toNumber(raw.betaWeightedDelta);
    const bpUsagePct = toNumber(raw.bpUsagePct);
    const vix = toNumber(raw.vix);
    return {
        cash,
        netLiq,
        buyingPower,
        availableFunds: availableFunds ?? null,
        excessLiquidity: excessLiquidity ?? null,
        dailyPnl: dailyPnl ?? null,
        dailyPnlPct: dailyPnlPct ?? null,
        realizedPnL: realizedPnL ?? null,
        unrealizedPnL: unrealizedPnL ?? null,
        portfolioDelta: portfolioDelta ?? null,
        portfolioTheta: portfolioTheta ?? null,
        betaWeightedDelta: betaWeightedDelta ?? null,
        bpUsagePct: bpUsagePct ?? null,
        vix: vix ?? null
    };
};
