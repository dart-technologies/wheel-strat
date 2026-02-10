import { store } from '@/data/store';

export type MarketCacheTier = 'hot' | 'warm' | 'cold';

type CacheEntry<T> = {
    key: string;
    tier: MarketCacheTier;
    payload: T;
    updatedAt: number;
    expiresAt: number;
    source?: string;
    symbol?: string;
    category?: string;
};

type CacheReadOptions = {
    tiers?: MarketCacheTier[];
    allowStale?: boolean;
};

type CacheWriteOptions = {
    tier?: MarketCacheTier;
    ttlMs?: number;
    source?: string;
    symbol?: string;
    category?: string;
};

const DEFAULT_TTL_MS: Record<MarketCacheTier, number> = {
    hot: 60 * 1000,
    warm: 60 * 60 * 1000,
    cold: 24 * 60 * 60 * 1000,
};

const DEFAULT_TIER_ORDER: MarketCacheTier[] = ['hot', 'warm', 'cold'];

const hotCache = new Map<string, CacheEntry<unknown>>();

const buildRowId = (key: string, tier: MarketCacheTier) => `${key}::${tier}`;

const toIso = (value: number) => new Date(value).toISOString();

const parseTime = (value?: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
};

export const getMarketCache = <T>(
    key: string,
    options: CacheReadOptions = {}
): {
    data: T;
    tier: MarketCacheTier;
    isStale: boolean;
    source?: string;
    updatedAt?: number;
    expiresAt?: number;
} | null => {
    const tiers = options.tiers?.length ? options.tiers : DEFAULT_TIER_ORDER;
    const allowStale = options.allowStale ?? false;

    for (const tier of tiers) {
        if (tier === 'hot') {
            const entry = hotCache.get(buildRowId(key, tier)) as CacheEntry<T> | undefined;
            if (!entry) continue;
            const isStale = entry.expiresAt <= Date.now();
            if (isStale && !allowStale) continue;
            return {
                data: entry.payload,
                tier,
                isStale,
                source: entry.source,
                updatedAt: entry.updatedAt,
                expiresAt: entry.expiresAt
            };
        }

        const rowId = buildRowId(key, tier);
        const row = store.getRow('marketCache', rowId) as Record<string, unknown> | undefined;
        if (!row || Object.keys(row).length === 0) continue;

        const expiresAt = parseTime(row.expiresAt);
        const updatedAt = parseTime(row.updatedAt);
        const isStale = expiresAt ? expiresAt <= Date.now() : false;
        if (isStale && !allowStale) continue;

        const rawPayload = row.payload;
        if (typeof rawPayload !== 'string') continue;
        try {
            const payload = JSON.parse(rawPayload) as T;
            return {
                data: payload,
                tier,
                isStale,
                source: typeof row.source === 'string' ? row.source : undefined,
                updatedAt: updatedAt ?? undefined,
                expiresAt: expiresAt ?? undefined
            };
        } catch {
            continue;
        }
    }

    return null;
};

export const setMarketCache = <T>(
    key: string,
    payload: T,
    options: CacheWriteOptions = {}
): CacheEntry<T> => {
    const tier = options.tier ?? 'warm';
    const ttl = options.ttlMs ?? DEFAULT_TTL_MS[tier];
    const updatedAt = Date.now();
    const expiresAt = updatedAt + ttl;
    const entry: CacheEntry<T> = {
        key,
        tier,
        payload,
        updatedAt,
        expiresAt,
        source: options.source,
        symbol: options.symbol,
        category: options.category,
    };

    if (tier === 'hot') {
        hotCache.set(buildRowId(key, tier), entry);
        return entry;
    }

    const row: Record<string, string> = {
        key,
        tier,
        payload: JSON.stringify(payload),
        updatedAt: toIso(updatedAt),
        expiresAt: toIso(expiresAt),
    };
    if (options.source) row.source = options.source;
    if (options.symbol) row.symbol = options.symbol;
    if (options.category) row.category = options.category;

    store.setRow('marketCache', buildRowId(key, tier), row);

    return entry;
};

export const clearMarketCache = (key?: string) => {
    if (!key) {
        hotCache.clear();
        store.delTable('marketCache');
        return;
    }
    (['hot', 'warm', 'cold'] as MarketCacheTier[]).forEach((tier) => {
        hotCache.delete(buildRowId(key, tier));
        store.delRow('marketCache', buildRowId(key, tier));
    });
};
