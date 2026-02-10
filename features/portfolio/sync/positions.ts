import { store } from '@/data/store';
import { CommunityPosition } from './types';
import { buildOptionRowId, isOptionPosition, normalizeSymbol, toNumber } from './normalize';

export const upsertPositions = (positions: CommunityPosition[]) => {
    const nextStockIds = new Set<string>();
    const nextOptionIds = new Set<string>();

    positions.forEach((position) => {
        const symbol = normalizeSymbol(position.symbol);
        if (!symbol) return;
        const quantity = toNumber(position.quantity);
        if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity === 0) return;
        const averageCost = toNumber(position.averageCost) ?? 0;
        const currentPrice = toNumber(position.currentPrice) ?? averageCost;
        const closePrice = toNumber(position.closePrice);
        const costBasis = toNumber(position.costBasis);
        const marketValue = toNumber(position.marketValue);
        const dailyPnl = toNumber(position.dailyPnl);
        const dailyPnlPct = toNumber(position.dailyPnlPct);
        const ivRank = toNumber(position.ivRank);
        const rsi = toNumber(position.rsi);
        const beta = toNumber(position.beta);
        const delta = toNumber(position.delta);
        const theta = toNumber(position.theta);
        const gamma = toNumber(position.gamma);
        const vega = toNumber(position.vega);

        if (isOptionPosition(position)) {
            const optionId = buildOptionRowId(position);
            if (!optionId) return;
            nextOptionIds.add(optionId);
            const existing = store.getRow('optionPositions', optionId);
            const multiplier = toNumber(position.multiplier) ?? 100;

            // Prefer IBKR's marketValue (already calculated correctly by IBKR)
            const ibkrMarketValue = toNumber(position.marketValue);
            const ibkrCostBasis = toNumber(position.costBasis);

            // For currentPrice, always derive from marketValue if available
            // IBKR's marketPrice can be unreliable for options (sometimes sends total value instead of per-share)
            let resolvedCurrentPrice = currentPrice;
            if (ibkrMarketValue !== undefined && quantity !== 0 && multiplier > 0) {
                // Derive per-share price from market value: marketValue / (quantity * multiplier)
                const derivedPrice = Math.abs(ibkrMarketValue / (quantity * multiplier));
                // Use derived price if it's reasonable (between $0.01 and $1000 per share)
                if (derivedPrice >= 0.01 && derivedPrice <= 1000) {
                    resolvedCurrentPrice = derivedPrice;
                    // console.log(`[syncHooks] Corrected ${symbol} option price from ${currentPrice} to ${derivedPrice} (derived from marketValue ${ibkrMarketValue})`);
                }
            }

            const resolvedMarketValue = ibkrMarketValue ?? (resolvedCurrentPrice * quantity * multiplier);
            const resolvedCostBasis = ibkrCostBasis ?? (averageCost * quantity * multiplier);

            const resolvedDailyPnl = typeof closePrice === 'number'
                ? (resolvedCurrentPrice - closePrice) * quantity * multiplier
                : null;
            const resolvedDailyPnlPct = typeof closePrice === 'number' && closePrice !== 0
                ? ((resolvedCurrentPrice - closePrice) / closePrice) * 100
                : null;

            store.setRow('optionPositions', optionId, {
                ...existing,
                symbol,
                quantity,
                averageCost,
                currentPrice: resolvedCurrentPrice,
                closePrice: closePrice ?? null,
                costBasis: resolvedCostBasis,
                marketValue: resolvedMarketValue,
                dailyPnl: resolvedDailyPnl,
                dailyPnlPct: resolvedDailyPnlPct,
                right: position.right ?? null,
                strike: toNumber(position.strike) ?? null,
                expiration: position.expiration ?? null,
                multiplier,
                secType: position.secType ?? null,
                localSymbol: position.localSymbol ?? null,
                conId: toNumber(position.conId) ?? null,
                companyName: position.companyName ?? existing.companyName ?? null
            });
            return;
        }

        nextStockIds.add(symbol);
        const existing = store.getRow('positions', symbol);
        const resolvedCostBasis = costBasis ?? (averageCost * quantity);
        const resolvedMarketValue = marketValue ?? (currentPrice * quantity);
        const resolvedDailyPnl = dailyPnl ?? (typeof closePrice === 'number'
            ? (currentPrice - closePrice) * quantity
            : null);
        const resolvedDailyPnlPct = dailyPnlPct ?? (typeof closePrice === 'number' && closePrice !== 0
            ? ((currentPrice - closePrice) / closePrice) * 100
            : null);
        store.setRow('positions', symbol, {
            ...existing,
            symbol,
            quantity,
            averageCost,
            currentPrice,
            closePrice: closePrice ?? null,
            costBasis: resolvedCostBasis,
            marketValue: resolvedMarketValue,
            dailyPnl: resolvedDailyPnl,
            dailyPnlPct: resolvedDailyPnlPct,
            ivRank: ivRank ?? existing.ivRank ?? null,
            rsi: rsi ?? existing.rsi ?? null,
            beta: beta ?? existing.beta ?? null,
            delta: delta ?? existing.delta ?? null,
            theta: theta ?? existing.theta ?? null,
            gamma: gamma ?? existing.gamma ?? null,
            vega: vega ?? existing.vega ?? null,
            companyName: position.companyName ?? existing.companyName ?? null
        });
    });

    return { nextStockIds, nextOptionIds };
};

export const removeCommunityPositionById = (id: string) => {
    if (!id) return;
    if (id.startsWith('opt_')) {
        store.delRow('optionPositions', id);
        return;
    }
    if (id.startsWith('stk_')) {
        store.delRow('positions', id.replace('stk_', ''));
        return;
    }
    store.delRow('positions', id);
};
