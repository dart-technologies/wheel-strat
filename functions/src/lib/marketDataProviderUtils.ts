import { fetchWithTimeout } from "./fetch";
import { ibkrMarketDataBatchSchema, parseIbkrResponse } from "./ibkrSchemas";

export const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || "NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

export const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
export const CONCURRENCY_LIMIT = 5;
export const BATCH_TIMEOUT_MS = 30000;

const LOG_LEVEL = (process.env.LOG_LEVEL || "").trim().toLowerCase();
export const LOG_INFO_ENABLED = ["info", "debug", "verbose"].includes(LOG_LEVEL);

// Simple in-memory cache for the function instance
const dataCache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
    const entry = dataCache.get(key);
    if (entry && entry.expires > Date.now()) {
        return entry.data as T;
    }
    return null;
}

export function setCache(key: string, data: any, ttl = CACHE_TTL_MS) {
    dataCache.set(key, { data, expires: Date.now() + ttl });
}

export async function fetchMarketDataBatch(
    bridgeUrl: string,
    symbols: string[],
    bridgeApiKey?: string
): Promise<Map<string, any> | null> {
    if (symbols.length === 0) return new Map();
    try {
        const res = await fetchWithTimeout(`${bridgeUrl}/market-data/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        }, BATCH_TIMEOUT_MS, bridgeApiKey);
        if (!res.ok) return null;
        const rawPayload = await res.json();
        const payload = parseIbkrResponse(ibkrMarketDataBatchSchema, rawPayload, 'market-data/batch');
        if (!payload) return null;
        const results = payload.results ?? [];
        const map = new Map<string, any>();
        results.forEach((item: { symbol?: string }) => {
            if (item?.symbol) map.set(String(item.symbol).toUpperCase(), item);
        });
        return map;
    } catch (error) {
        console.warn('❌ [IbkrMarketDataProvider] Batch market data failed:', error);
        return null;
    }
}

export function pickExpiration(expirations: string[]) {
    return expirations.find((exp) => {
        const expDate = new Date(exp.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
        const days = Math.ceil((expDate.getTime() - Date.now()) / 86400000);
        return days >= 14 && days <= 45;
    }) || expirations[0];
}

export function pickStrike(strikes: number[], currentPrice: number) {
    const sorted = [...strikes].sort((a, b) => a - b);
    let closest = sorted[0];
    let minDiff = Math.abs(sorted[0] - currentPrice);
    for (const strike of sorted) {
        const diff = Math.abs(strike - currentPrice);
        if (diff < minDiff) {
            minDiff = diff;
            closest = strike;
        }
    }
    return closest;
}

/**
 * Limit concurrency of promises
 */
export async function parallelLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    for (const item of items) {
        const p = fn(item).then((res) => {
            results.push(res);
        });
        executing.push(p);
        if (executing.length >= limit) {
            await Promise.race(executing);
            // Remove finished promises
            for (let i = executing.length - 1; i >= 0; i--) {
                const status = await Promise.race([executing[i], Promise.resolve('pending')]);
                if (status !== 'pending') executing.splice(i, 1);
            }
        }
    }
    await Promise.all(executing);
    return results;
}
