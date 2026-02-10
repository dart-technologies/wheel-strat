import { refreshLiveOptions } from '@/services/api';
import { applyLiveOptionMarketData, refreshPortfolioNetLiq } from './store';
import { getMarketCache, setMarketCache } from '@/data/marketData/cache';
import type { LiveOptionSnapshot, MarketDataStore } from './types';
import type { DteWindow } from '@wheel-strat/shared';
import { store } from '@/data/store';

type LiveOptionResponse = {
    results?: LiveOptionSnapshot[];
};

const LIVE_OPTIONS_TTL_MS = 60 * 1000;
const LIVE_OPTIONS_WARM_TTL_MS = 6 * 60 * 60 * 1000;

export const buildLiveOptionsKey = (symbol: string, dteWindow?: DteWindow, targetWinProb?: number) => (
    `live-options:${symbol.toUpperCase()}:${dteWindow || 'default'}:${Math.round(targetWinProb || 0)}`
);

const hasValidLeg = (leg: LiveOptionSnapshot['cc']) => {
    if (!leg) return false;
    const strike = Number(leg.strike);
    const premium = Number(leg.premium);
    if (!Number.isFinite(strike) || strike <= 0) return false;
    if (!Number.isFinite(premium) || premium <= 0) return false;
    if (!leg.expiration) return false;
    return true;
};

export async function refreshLiveOptionData(
    symbols: string[],
    targetWinProb = 70,
    dteWindow?: DteWindow,
    storeInstance?: MarketDataStore,
    options?: { source?: string; logThresholdMs?: number; skipGreeks?: boolean }
) {
    const startedAt = Date.now();
    const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));
    if (uniqueSymbols.length === 0) {
        const netLiq = storeInstance
            ? refreshPortfolioNetLiq(storeInstance)
            : refreshPortfolioNetLiq();
        return { results: [], updatedSymbols: [], netLiq };
    }

    const payload = await refreshLiveOptions(uniqueSymbols, targetWinProb, dteWindow, {
        skipGreeks: options?.skipGreeks
    });
    if (payload?.error) {
        console.warn('[marketData] refreshLiveOptions failed', {
            error: payload.error?.message || String(payload.error),
            symbols: uniqueSymbols,
            targetWinProb,
            dteWindow
        });
    }

    const response = payload?.data as LiveOptionResponse | undefined;
    const results = Array.isArray(response?.results) ? response.results : [];
    if (!payload?.error && results.length === 0) {
        console.warn('[marketData] refreshLiveOptions returned no results', {
            symbols: uniqueSymbols,
            targetWinProb,
            dteWindow
        });
    }

    const normalizedResults: LiveOptionSnapshot[] = results
        .map((snapshot) => {
            if (!snapshot?.symbol) return null;
            const normalized: LiveOptionSnapshot = {
                symbol: snapshot.symbol,
                currentPrice: snapshot.currentPrice
            };
            if (hasValidLeg(snapshot.cc)) {
                normalized.cc = snapshot.cc;
            }
            if (hasValidLeg(snapshot.csp)) {
                normalized.csp = snapshot.csp;
            }
            return normalized;
        })
        .filter((snapshot): snapshot is LiveOptionSnapshot => Boolean(snapshot));

    const mergedResults = normalizedResults.map((snapshot) => {
        if (!snapshot.symbol) return snapshot;
        const key = buildLiveOptionsKey(snapshot.symbol, dteWindow, targetWinProb);
        const cached = getMarketCache<LiveOptionSnapshot>(key, { tiers: ['hot', 'warm'], allowStale: false });
        const hadFreshCc = Boolean(snapshot.cc);
        const hadFreshCsp = Boolean(snapshot.csp);

        if (!snapshot.cc && cached?.data?.cc) {
            snapshot.cc = cached.data.cc;
        }
        if (!snapshot.csp && cached?.data?.csp) {
            snapshot.csp = cached.data.csp;
        }

        if (hadFreshCc || hadFreshCsp) {
            setMarketCache(key, snapshot, {
                tier: 'hot',
                ttlMs: LIVE_OPTIONS_TTL_MS,
                source: 'bridge',
                symbol: snapshot.symbol.toUpperCase(),
                category: 'live-options'
            });
            setMarketCache(key, snapshot, {
                tier: 'warm',
                ttlMs: LIVE_OPTIONS_WARM_TTL_MS,
                source: 'bridge',
                symbol: snapshot.symbol.toUpperCase(),
                category: 'live-options'
            });
        }

        return snapshot;
    });

    const snapshot = storeInstance
        ? applyLiveOptionMarketData(mergedResults, storeInstance)
        : applyLiveOptionMarketData(mergedResults);

    // Track persistent market refresh time
    store.setCell('syncMetadata', 'main', 'lastMarketRefresh', new Date().toISOString());

    if (__DEV__) {
        const durationMs = Date.now() - startedAt;
        const threshold = options?.logThresholdMs ?? 5000;
        if (durationMs >= threshold || payload?.error) {
            console.log('[marketData] refreshLiveOptionData', {
                source: options?.source,
                durationMs,
                symbols: uniqueSymbols.length,
                results: mergedResults.length,
                error: payload?.error?.message ?? null
            });
        }
    }

    return { results: mergedResults, error: payload?.error ?? null, ...snapshot };
}
