import { store } from '@/data/store';
import type { CorporateAction } from '@wheel-strat/shared';

const toNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeSymbol = (value?: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : '';
};

const parseDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const adjustValue = (value: number, ratio: number) => value / ratio;

const adjustStrike = (value?: number, ratio?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value;
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio === 0) return value;
    return adjustValue(value, ratio);
};

const adjustPremium = (value?: number, ratio?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value;
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio === 0) return value;
    return adjustValue(value, ratio);
};

export function syncCorporateActionsRows(actions: CorporateAction[]) {
    const nextIds = new Set<string>();
    actions.forEach((action) => {
        if (!action?.id) return;
        nextIds.add(action.id);
        const existing = store.getRow('corporateActions', action.id);
        const processedAt = typeof existing?.processedAt === 'string' ? existing.processedAt : undefined;
        store.setRow('corporateActions', action.id, {
            ...existing,
            symbol: action.symbol,
            type: action.type,
            ratio: action.ratio ?? null,
            exDate: action.exDate ?? null,
            effectiveDate: action.effectiveDate ?? null,
            source: action.source ?? null,
            processedAt: processedAt ?? (action.processedAt as string | undefined) ?? null
        });
    });

    const existingIds = store.getRowIds('corporateActions');
    existingIds.forEach((id) => {
        if (!nextIds.has(id)) {
            store.delRow('corporateActions', id);
        }
    });
}

export function applyCorporateActions(actions: CorporateAction[]) {
    const now = new Date();
    actions.forEach((action) => {
        if (!action?.id) return;
        if (action.type !== 'split') return;
        const ratio = toNumber(action.ratio);
        if (!ratio || ratio === 1) return;
        const actionDate = parseDate(action.effectiveDate || action.exDate);
        if (actionDate && actionDate > now) return;

        const existingAction = store.getRow('corporateActions', action.id);
        if (existingAction?.processedAt) return;

        const symbol = normalizeSymbol(action.symbol);
        if (!symbol) return;

        const position = store.getRow('positions', symbol);
        if (position && Object.keys(position).length > 0) {
            const quantity = toNumber(position.quantity) ?? 0;
            const averageCost = toNumber(position.averageCost) ?? 0;
            const currentPrice = toNumber(position.currentPrice);
            const hasCurrentPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice);
            const nextQuantity = quantity * ratio;
            const nextAvgCost = quantity !== 0 ? (averageCost / ratio) : averageCost;
            const nextCostBasis = Number.isFinite(nextAvgCost) ? nextAvgCost * nextQuantity : position.costBasis;
            const nextMarketValue = hasCurrentPrice
                ? currentPrice * nextQuantity
                : position.marketValue;
            const resolvedAvgCost = Number.isFinite(nextAvgCost) ? nextAvgCost : null;

            store.setRow('positions', symbol, {
                ...position,
                quantity: nextQuantity,
                averageCost: resolvedAvgCost,
                costBasis: nextCostBasis,
                marketValue: nextMarketValue,
                ccStrike: adjustStrike(toNumber(position.ccStrike), ratio) ?? null,
                cspStrike: adjustStrike(toNumber(position.cspStrike), ratio) ?? null,
                ccPremium: adjustPremium(toNumber(position.ccPremium), ratio) ?? null,
                cspPremium: adjustPremium(toNumber(position.cspPremium), ratio) ?? null,
            });
        }

        const optionTable = store.getTable('optionPositions');
        Object.entries(optionTable).forEach(([id, row]) => {
            const rowSymbol = normalizeSymbol(String(row.symbol || ''));
            if (rowSymbol !== symbol) return;
            const quantity = toNumber(row.quantity) ?? 0;
            const multiplier = toNumber(row.multiplier) ?? 100;
            const averageCost = toNumber(row.averageCost);
            const currentPrice = toNumber(row.currentPrice);
            const strike = toNumber(row.strike);

            const nextMultiplier = multiplier * ratio;
            const nextAvgCost = (typeof averageCost === 'number' && Number.isFinite(averageCost))
                ? averageCost / ratio
                : null;
            const nextCurrentPrice = (typeof currentPrice === 'number' && Number.isFinite(currentPrice))
                ? currentPrice / ratio
                : null;
            const nextStrike = (typeof strike === 'number' && Number.isFinite(strike))
                ? strike / ratio
                : null;

            const nextCostBasis = typeof nextAvgCost === 'number'
                ? nextAvgCost * quantity * nextMultiplier
                : row.costBasis;
            const nextMarketValue = typeof nextCurrentPrice === 'number'
                ? nextCurrentPrice * quantity * nextMultiplier
                : row.marketValue;

            store.setRow('optionPositions', id, {
                ...row,
                strike: nextStrike,
                multiplier: nextMultiplier,
                averageCost: nextAvgCost,
                currentPrice: nextCurrentPrice,
                costBasis: nextCostBasis,
                marketValue: nextMarketValue
            });
        });

        store.setCell('corporateActions', action.id, 'processedAt', new Date().toISOString());
    });
}
