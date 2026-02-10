import { OptionPosition, Position } from '@wheel-strat/shared';

const stockPriceCache = new Map<string, number>();
const optionPriceCache = new Map<string, number>();

export const normalizeExpiration = (value?: string) => {
    if (!value) return '';
    const compact = value.replace(/-/g, '');
    return compact.length === 8 ? compact : value;
};

const normalizeSymbol = (value?: string) => (value || '').toUpperCase();

const getOptionCacheKey = (option: OptionPosition) => {
    if (Number.isFinite(Number(option.conId))) return `OPT:${option.conId}`;
    if (option.localSymbol) return `OPT:${option.localSymbol}`;
    const symbol = normalizeSymbol(option.symbol);
    const right = (option.right || '').toUpperCase() || 'X';
    const strike = Number.isFinite(Number(option.strike)) ? Number(option.strike) : 0;
    const expiration = normalizeExpiration(option.expiration);
    return `OPT:${symbol}:${right}:${strike}:${expiration || 'na'}`;
};

export const getStableOptionPrice = (option: OptionPosition) => {
    const live = Number(option.currentPrice);
    const key = getOptionCacheKey(option);
    if (Number.isFinite(live) && live > 0) {
        optionPriceCache.set(key, live);
        return live;
    }
    const cached = optionPriceCache.get(key);
    if (Number.isFinite(cached) && (cached as number) > 0) {
        return cached as number;
    }
    const averageCost = Number(option.averageCost);
    return Number.isFinite(averageCost) ? averageCost : 0;
};

export const getOptionMarketValue = (option: OptionPosition) => {
    // Prioritize Source of Truth from IBKR (synced to store)
    if (typeof option.marketValue === 'number' && option.marketValue !== 0) {
        return option.marketValue;
    }
    const multiplier = option.multiplier ?? 100;
    const mark = getStableOptionPrice(option);
    return mark * (option.quantity || 0) * multiplier;
};

const getPositionPrice = (position: Position) => {
    const symbol = normalizeSymbol(position.symbol);

    // Prioritize Source of Truth from IBKR (synced to store as marketPrice)
    if (typeof position.marketPrice === 'number' && position.marketPrice > 0) {
        return position.marketPrice;
    }

    const live = Number(position.currentPrice);
    if (Number.isFinite(live) && live > 0) {
        if (symbol) {
            stockPriceCache.set(symbol, live);
        }
        return live;
    }
    const cached = symbol ? stockPriceCache.get(symbol) : undefined;
    if (Number.isFinite(cached) && (cached as number) > 0) return cached as number;
    const fallback = Number(position.averageCost);
    return Number.isFinite(fallback) ? fallback : 0;
};

export const getStablePositionPrice = (position: Position) => getPositionPrice(position);
