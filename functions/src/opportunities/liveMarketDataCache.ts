const LIVE_OPTIONS_CACHE_TTL_MS = 2 * 60 * 1000;
const liveOptionsCache = new Map<string, { timestamp: number; snapshot: any }>();

export function buildLiveCacheKey(symbol: string, targetWinProb: number, dteRange: { minDays: number; maxDays: number }) {
    return `${symbol.toUpperCase()}:${Math.round(targetWinProb)}:${dteRange.minDays}-${dteRange.maxDays}`;
}

export function getCachedLiveSnapshot(key: string) {
    const entry = liveOptionsCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > LIVE_OPTIONS_CACHE_TTL_MS) return null;
    return entry.snapshot;
}

export function setCachedLiveSnapshot(key: string, snapshot: any) {
    liveOptionsCache.set(key, { timestamp: Date.now(), snapshot });
}
