import { fetchHistoricalBars } from '@/services/api';
import { getMarketCache, setMarketCache, type MarketCacheTier } from '@/data/marketData/cache';

type HistoricalBarsResult = {
    bars: any[];
    source: 'db' | 'fallback' | 'cache-warm' | 'cache-cold' | 'bridge' | 'unknown';
    isStale?: boolean;
};

type FetchOptions = {
    limit?: number;
    startDate?: string;
    endDate?: string;
    tier?: MarketCacheTier;
    ttlMs?: number;
    allowStale?: boolean;
};

const buildHistoryCacheKey = (symbol: string, limit?: number, startDate?: string, endDate?: string) => {
    const pieces = [
        'history',
        symbol.toUpperCase(),
        limit ? String(limit) : 'all',
        startDate || 'start',
        endDate || 'end'
    ];
    return pieces.join(':');
};

const getCacheSource = (tier: MarketCacheTier) => (
    tier === 'warm' ? 'cache-warm' : 'cache-cold'
);

export async function getHistoricalBarsCached(
    symbol: string,
    options: FetchOptions = {}
): Promise<HistoricalBarsResult | null> {
    const limit = options.limit;
    const tier = options.tier ?? 'warm';
    const cacheKey = buildHistoryCacheKey(symbol, limit, options.startDate, options.endDate);
    const cached = getMarketCache<any[]>(cacheKey, { tiers: [tier], allowStale: true });

    if (cached && !cached.isStale) {
        return {
            bars: cached.data,
            source: getCacheSource(tier),
            isStale: false
        };
    }

    const response = await fetchHistoricalBars(symbol, {
        limit,
        startDate: options.startDate,
        endDate: options.endDate
    });
    const payload = (response as any)?.data ?? response;
    const bars = Array.isArray(payload?.bars) ? payload.bars : [];
    const source = (payload?.source as 'db' | 'fallback' | 'unknown') || 'unknown';

    if (bars.length > 0) {
        setMarketCache(cacheKey, bars, {
            tier,
            ttlMs: options.ttlMs,
            source,
            symbol: symbol.toUpperCase(),
            category: 'history'
        });
        return { bars, source: source === 'unknown' ? 'bridge' : source };
    }

    if (cached) {
        return {
            bars: cached.data,
            source: getCacheSource(tier),
            isStale: true
        };
    }

    return null;
}
