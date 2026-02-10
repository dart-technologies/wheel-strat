import { getMarketCache, setMarketCache } from '@/data/marketData/cache';
import { buildLiveOptionsKey, refreshLiveOptionData } from '@/data/marketData';
import { fetchOpportunitiesForSymbol } from '@/services/api';
import { getTargetWinProb } from '@/utils/risk';
import { getDaysToExpiration } from '@/utils/time';
import type { DteWindow, Opportunity, Position, RiskLevel } from '@wheel-strat/shared';

type PrefetchOptions = {
    riskLevel: RiskLevel;
    dteWindow: DteWindow;
};

export const PREFETCH_COOLDOWN_MS = 5 * 60 * 1000;

const LIVE_OPTIONS_TTL_MS = 60 * 1000;
const ANALYST_TTL_MS = 60 * 60 * 1000;

const normalizeSymbol = (symbol?: string) => (symbol || '').toUpperCase();

const buildAnalystKey = (symbol: string) => `analyst-report:${symbol}`;

export const getActionableSymbols = (
    positions: Record<string, Position>,
    limit = 3
): string[] => {
    const entries = Object.values(positions || {})
        .filter((pos) => pos?.symbol)
        .map((pos) => {
            const symbol = normalizeSymbol(pos.symbol);
            const ccDte = getDaysToExpiration(pos.ccExpiration);
            const cspDte = getDaysToExpiration(pos.cspExpiration);
            const dteValues = [ccDte, cspDte].filter((value): value is number => typeof value === 'number');
            const minDte = dteValues.length > 0 ? Math.min(...dteValues) : null;
            const marketValue = Number(pos.marketValue)
                || (Number(pos.currentPrice) || 0) * (Number(pos.quantity) || 0);
            return { symbol, minDte, marketValue };
        })
        .filter((entry) => entry.symbol);

    const withExpirations = entries.filter((entry) => typeof entry.minDte === 'number');
    const sorted = (withExpirations.length > 0 ? withExpirations : entries)
        .sort((a, b) => {
            const aDte = typeof a.minDte === 'number' ? a.minDte : Number.POSITIVE_INFINITY;
            const bDte = typeof b.minDte === 'number' ? b.minDte : Number.POSITIVE_INFINITY;
            if (aDte !== bDte) return aDte - bDte;
            return (b.marketValue || 0) - (a.marketValue || 0);
        });

    return sorted.slice(0, limit).map((entry) => entry.symbol);
};

const prefetchLiveOptions = async (
    symbols: string[],
    options: PrefetchOptions
) => {
    const targetWinProb = getTargetWinProb(options.riskLevel);
    const missingSymbols = symbols.filter((symbol) => {
        const key = buildLiveOptionsKey(symbol, options.dteWindow, targetWinProb);
        return !getMarketCache(key, { tiers: ['hot'], allowStale: false });
    });

    if (missingSymbols.length === 0) return;
    const payload = await refreshLiveOptionData(missingSymbols, targetWinProb, options.dteWindow, undefined, {
        source: 'market_prefetch',
        logThresholdMs: 3000,
        skipGreeks: true
    });
    const results = Array.isArray(payload?.results) ? payload.results : [];
    results.forEach((result) => {
        if (!result?.symbol) return;
        const normalized = normalizeSymbol(result.symbol);
        const key = buildLiveOptionsKey(normalized, options.dteWindow, targetWinProb);
        setMarketCache(key, result, {
            tier: 'hot',
            ttlMs: LIVE_OPTIONS_TTL_MS,
            source: 'bridge',
            symbol: normalized,
            category: 'live-options'
        });
    });
};

const prefetchAnalystReports = async (symbols: string[]) => {
    await Promise.all(symbols.map(async (symbol) => {
        const key = buildAnalystKey(symbol);
        if (getMarketCache(key, { tiers: ['warm'], allowStale: false })) return;
        const response = await fetchOpportunitiesForSymbol(symbol);
        const payload = (response as any)?.data ?? response;
        const opportunities = Array.isArray(payload) ? payload : [];
        setMarketCache<Opportunity[]>(key, opportunities, {
            tier: 'warm',
            ttlMs: ANALYST_TTL_MS,
            source: 'firestore',
            symbol,
            category: 'analyst-report'
        });
    }));
};

export const prefetchActionablePositions = async (
    symbols: string[],
    options: PrefetchOptions
) => {
    if (!symbols.length) return;
    const uniqueSymbols = Array.from(new Set(symbols.map(normalizeSymbol))).filter(Boolean);
    if (uniqueSymbols.length === 0) return;

    await Promise.all([
        prefetchLiveOptions(uniqueSymbols, options),
        prefetchAnalystReports(uniqueSymbols)
    ]);
};
