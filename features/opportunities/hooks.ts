import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCell, useTable, useResultTable, useResultSortedRowIds } from 'tinybase/ui-react';
import { scanPortfolio } from '@/services/api';
import { applyOpportunityMarketData, buildLiveOptionsKey, refreshMarketData } from '@/data/marketData';
import { getMarketCache } from '@/data/marketData/cache';
import type { LiveOptionLeg, LiveOptionSnapshot } from '@/data/marketData/types';
import { Opportunity, Portfolio, Position } from '@wheel-strat/shared';
import { store, queries } from '@/data/store';
import { useDteWindow, useRiskProfile, useTraderLevel } from '@/features/settings/hooks';
import { getTargetWinProb } from '@/utils/risk';
import { getDaysToExpiration } from '@/utils/time';

const MEDALS = ['🥇', '🥈', '🥉'];
const MIN_LIVE_PREMIUM = 0.05;

/**
 * Helper to safely parse JSON strings
 */
const safeParse = (value: any) => {
    if (typeof value !== 'string' || !value.trim()) return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return value;
    }
};

/**
 * Helper to parse analysis JSON if needed
 */
const parseOpportunity = (row: any): Opportunity => {
    if (!row) return {} as Opportunity;
    return {
        ...row,
        analysis: safeParse(row.analysis),
        context: safeParse(row.context),
    };
};

const normalizeWinProb = (value: unknown, fallback: number) => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const hasValidPremium = (value: unknown) => (
    typeof value === 'number' && Number.isFinite(value) && value >= MIN_LIVE_PREMIUM
);

const buildLiveOpportunity = (
    symbol: string,
    currentPrice: number | undefined,
    leg: LiveOptionLeg | null | undefined,
    strategy: Opportunity['strategy'],
    targetWinProb: number,
    priority: number,
    createdAt: string
): Opportunity | null => {
    if (!leg) return null;
    if (typeof leg.strike !== 'number' || !Number.isFinite(leg.strike)) return null;
    if (!hasValidPremium(leg.premium)) return null;
    const dte = getDaysToExpiration(leg.expiration);
    if (!dte || dte <= 0) return null;
    const winProb = normalizeWinProb(leg.winProb, targetWinProb);
    const normalizedPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice)
        ? currentPrice
        : undefined;

    return {
        symbol,
        strategy,
        strike: leg.strike,
        expiration: leg.expiration,
        premium: leg.premium,
        winProb,
        ivRank: 0,
        annualizedYield: Number.isFinite(leg.annualizedYield) ? leg.annualizedYield : undefined,
        reasoning: 'Live quote',
        priority,
        delta: leg.delta,
        gamma: leg.gamma,
        theta: leg.theta,
        vega: leg.vega,
        currentPrice: normalizedPrice,
        createdAt
    };
};

const buildLiveOpportunities = (
    snapshots: LiveOptionSnapshot[],
    targetWinProb: number,
    createdAt: string
) => {
    const opportunities: Opportunity[] = [];
    snapshots.forEach((snapshot) => {
        if (!snapshot?.symbol) return;
        const symbol = snapshot.symbol.toUpperCase();
        const currentPrice = typeof snapshot.currentPrice === 'number' && Number.isFinite(snapshot.currentPrice)
            ? snapshot.currentPrice
            : undefined;
        const ccOpp = buildLiveOpportunity(
            symbol,
            currentPrice,
            snapshot.cc,
            'Covered Call',
            targetWinProb,
            1,
            createdAt
        );
        const cspOpp = buildLiveOpportunity(
            symbol,
            currentPrice,
            snapshot.csp,
            'Cash-Secured Put',
            targetWinProb,
            ccOpp ? 2 : 1,
            createdAt
        );
        if (ccOpp) opportunities.push(ccOpp);
        if (cspOpp) opportunities.push(cspOpp);
    });
    return opportunities;
};

/**
 * Unified hook for querying opportunities from TinyBase.
 * Uses 'opportunities_by_date' query for efficient sorting.
 */
export function useOpportunitiesStore(limitCount = 20) {
    // Use strictly ordered IDs
    const sortedRowIds = useResultSortedRowIds('opportunities_by_date', 'createdAt', true, 0, limitCount, queries);
    const resultTable = useResultTable('opportunities_by_date', queries);

    const opportunities = useMemo(() => {
        return sortedRowIds.map((rowId: string) => parseOpportunity(resultTable[rowId]));
    }, [sortedRowIds, resultTable]);

    const loading = sortedRowIds.length === 0 && Object.keys(resultTable).length === 0;

    const refresh = useCallback(async () => {
        try {
            await refreshMarketData({
                orderByField: 'createdAt',
                direction: 'desc',
                // limitCount is removed here as useResultSortedRowIds handles the limit for display
            });
        } catch (error) {
            console.error('Error refreshing opportunities:', error);
        }
    }, []);

    return { opportunities, loading, refresh };
}

export function useRecentOpportunities(limitCount = 20) {
    const { opportunities, loading, refresh } = useOpportunitiesStore(limitCount);

    return {
        recentOpportunities: opportunities,
        refreshing: loading,
        refresh
    };
}

export function useOpportunities(limitCount = 10) {
    // Use strictly ordered IDs for priority
    const sortedRowIds = useResultSortedRowIds('opportunities_by_priority', 'priorityValue', false, 0, limitCount, queries);
    const resultTable = useResultTable('opportunities_by_priority', queries);

    const opportunities = useMemo(() => {
        return sortedRowIds.map((rowId: string) => parseOpportunity(resultTable[rowId]));
    }, [sortedRowIds, resultTable]);

    return {
        opportunities,
        loading: sortedRowIds.length === 0 && Object.keys(resultTable).length === 0
    };
}

export function useOpportunitySynopsis() {
    const synopsis = useCell('appSettings', 'main', 'opportunitySynopsis', store) as string;
    return { synopsis: synopsis || '', loading: !synopsis };
}

export function useMarketOpportunities(symbol?: string) {
    const [marketOpportunities, setMarketOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const { currentRisk } = useRiskProfile();
    const { currentDteWindow } = useDteWindow();
    const targetWinProb = useMemo(() => getTargetWinProb(currentRisk), [currentRisk]);

    useEffect(() => {
        if (!symbol) return;
        let isActive = true;
        setLoading(true);
        setMarketOpportunities([]);

        const loadOpportunities = async () => {
            const applyCachedOpportunities = () => {
                const cacheKey = buildLiveOptionsKey(symbol, currentDteWindow, targetWinProb);
                const cached = getMarketCache<LiveOptionSnapshot>(cacheKey, {
                    tiers: ['hot', 'warm', 'cold'],
                    allowStale: true
                });
                if (!cached?.data) return false;
                const cachedCreatedAt = cached.updatedAt
                    ? new Date(cached.updatedAt).toISOString()
                    : new Date().toISOString();
                const cachedOpps = buildLiveOpportunities([cached.data], targetWinProb, cachedCreatedAt);
                if (cachedOpps.length === 0) return false;
                applyOpportunityMarketData(cachedOpps);
                if (isActive) setMarketOpportunities(cachedOpps);
                return true;
            };

            try {
                const refreshedAt = new Date().toISOString();
                const { refreshLiveOptionData } = require('@/data/marketData');
                const livePayload = await refreshLiveOptionData([symbol], targetWinProb, currentDteWindow, undefined, {
                    source: 'opportunity_refresh',
                    logThresholdMs: 3000,
                    skipGreeks: true
                });
                const liveResults = Array.isArray(livePayload?.results) ? livePayload.results : [];
                const liveOpps = buildLiveOpportunities(liveResults, targetWinProb, refreshedAt);

                if (liveOpps.length > 0) {
                    applyOpportunityMarketData(liveOpps);
                    if (isActive) setMarketOpportunities(liveOpps);
                    return;
                }

                if (applyCachedOpportunities()) return;

                if (livePayload?.error) {
                    console.warn('Live opportunities refresh failed.', livePayload.error);
                } else {
                    console.warn('Live opportunities returned no valid legs.', { symbol, targetWinProb, currentDteWindow });
                }
                if (isActive) setMarketOpportunities([]);
            } catch (error) {
                console.error('Error fetching market opportunities:', error);
                if (!applyCachedOpportunities() && isActive) {
                    setMarketOpportunities([]);
                }
            } finally {
                if (isActive) setLoading(false);
            }
        };

        loadOpportunities();

        return () => {
            isActive = false;
        };
    }, [symbol, targetWinProb, currentDteWindow]);

    return { marketOpportunities, loading };
}

export function useYieldMap(opportunities: Opportunity[]) {
    return useMemo(() => {
        const map: Record<string, { cc?: number; csp?: number; ccMedal?: string; cspMedal?: string }> = {};

        opportunities.forEach((opp) => {
            if (!map[opp.symbol]) map[opp.symbol] = {};
            const medal = opp.priority !== undefined && opp.priority >= 1 && opp.priority <= 3
                ? MEDALS[opp.priority - 1]
                : undefined;

            if (opp.strategy === 'Covered Call') {
                map[opp.symbol].cc = opp.annualizedYield;
                if (medal) map[opp.symbol].ccMedal = medal;
            } else if (opp.strategy === 'Cash-Secured Put') {
                map[opp.symbol].csp = opp.annualizedYield;
                if (medal) map[opp.symbol].cspMedal = medal;
            }
        });

        return map;
    }, [opportunities]);
}

export function useScanPortfolio() {
    const [scanning, setScanning] = useState(false);
    const { currentRisk } = useRiskProfile();
    const { currentTraderLevel } = useTraderLevel();
    const { currentDteWindow } = useDteWindow();

    const runScan = useCallback(async (positions: Record<string, Position>, portfolio: Portfolio) => {
        try {
            setScanning(true);

            const positionsArray = Object.values(positions).map((pos) => ({
                symbol: pos.symbol,
                quantity: pos.quantity,
                averageCost: pos.averageCost,
                currentPrice: pos.currentPrice || pos.averageCost
            }));

            const cash = portfolio.buyingPower || portfolio.cash || 250000;
            const result = await scanPortfolio(positionsArray, cash, {
                riskLevel: currentRisk,
                traderLevel: currentTraderLevel,
                dteWindow: currentDteWindow,
            });

            if (result.error) {
                console.error('Scan failed:', result.error);
                return false;
            }

            store.setCell('appSettings', 'main', 'analysisRiskLevel', currentRisk);
            store.setCell('appSettings', 'main', 'analysisTraderLevel', currentTraderLevel);
            store.setCell('appSettings', 'main', 'analysisDteWindow', currentDteWindow);
            store.setCell('appSettings', 'main', 'analysisUpdatedAt', new Date().toISOString());
            return true;
        } catch (error) {
            console.error('Scan failed:', error);
            return false;
        } finally {
            setScanning(false);
        }
    }, [currentRisk, currentTraderLevel, currentDteWindow]);

    return { scanning, runScan };
}
