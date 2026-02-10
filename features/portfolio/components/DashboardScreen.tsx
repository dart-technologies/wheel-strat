import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Text, View, useWindowDimensions, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { useCell, useValue } from 'tinybase/ui-react';

import { store } from "@/data/store";
import { SEED_FLAG_KEY } from "@/services/data";
import ScreenLayout from "@/components/ScreenLayout";
import EducationModal from "@/components/EducationModal";
import BridgeStatus from "@/components/BridgeStatus";
import MarketStatusPill from "@/components/MarketStatusPill";
import FreshnessIndicator from "@/components/FreshnessIndicator";

import StrategyExplainer from "@/components/StrategyExplainer";
import { DashboardSummarySection } from "@/features/portfolio/components/dashboard/DashboardSummarySection";
import { Theme } from "@/constants/theme";
import { styles } from "@/features/portfolio/components/dashboard/styles";
import { useOpportunities } from "@/features/opportunities/hooks";
import {
    PositionSortMode,
    useGroupedPositions,
    usePortfolio,
    usePortfolioPerformance,
    useRealizedPnL,
    useEquitySnapshot
} from "@/features/portfolio/hooks";
import { useDteWindow, useOnboardingState, useRiskProfile } from "@/features/settings/hooks";
import { Analytics } from "@/services/analytics";
import { refreshLiveOptionData } from "@/data/marketData";
import { Opportunity } from "@wheel-strat/shared";
import { getTargetWinProb } from "@/utils/risk";
import { getDaysToExpiration } from "@/utils/time";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useAdaptiveMarketRefresh } from "@/hooks/useAdaptiveMarketRefresh";
import { useAuth } from "@/hooks/useAuth";
import { getDteWindowRange } from "@/utils/settings";
import { useSpeculativePrefetch } from "@/hooks/useSpeculativePrefetch";
import { useMinuteTicker } from "@/hooks/useMinuteTicker";


const toTimestamp = (value?: unknown) => {
    if (!value) return null;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
};

const toFiniteNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const STALE_MARKET_REFRESH_MS = 5 * 60 * 1000;

export default function DashboardScreen() {
    const { width } = useWindowDimensions();
    const isIPad = width > 768;
    const insets = useSafeAreaInsets();
    const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
    const [sortMode, setSortMode] = useState<PositionSortMode>('marketValue');
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuth();
    
    useMinuteTicker();

    const lastPortfolioSyncStr = useCell('syncMetadata', 'main', 'lastPortfolioSync', store);
    const lastPositionsSyncStr = useCell('syncMetadata', 'main', 'lastPositionsSync', store);
    const lastMarketRefreshStr = useCell('syncMetadata', 'main', 'lastMarketRefresh', store);
    const lastMarketRefresh = lastMarketRefreshStr ? new Date(String(lastMarketRefreshStr)) : null;
    const lastPortfolioSync = useMemo(() => toTimestamp(lastPortfolioSyncStr), [lastPortfolioSyncStr]);
    const lastPositionsSync = useMemo(() => toTimestamp(lastPositionsSyncStr), [lastPositionsSyncStr]);
    const lastMarketRefreshTime = useMemo(() => toTimestamp(lastMarketRefreshStr), [lastMarketRefreshStr]);

    const cachedDailyPnlCell = useCell('syncMetadata', 'main', 'lastDailyPnl', store);
    const cachedDailyPnlPctCell = useCell('syncMetadata', 'main', 'lastDailyPnlPct', store);
    const cachedUnrealizedPnlCell = useCell('syncMetadata', 'main', 'lastUnrealizedPnl', store);
    const cachedUnrealizedPnlPctCell = useCell('syncMetadata', 'main', 'lastUnrealizedPnlPct', store);

    const marketStatus = useMarketStatus();

    const { isVisible: showOnboarding, markOnboardingSeen } = useOnboardingState();
    const { currentRisk } = useRiskProfile();
    const { currentDteWindow } = useDteWindow();
    const targetWinProb = useMemo(() => getTargetWinProb(currentRisk), [currentRisk]);
    const { opportunities } = useOpportunities(12);

    useEffect(() => {
        Analytics.logScreenView('Dashboard');
    }, []);


    const { portfolio, positions, optionPositions } = usePortfolio();

    const cachedDailyPnl = useMemo(() => toFiniteNumber(cachedDailyPnlCell), [cachedDailyPnlCell]);
    const cachedDailyPnlPct = useMemo(() => toFiniteNumber(cachedDailyPnlPctCell), [cachedDailyPnlPctCell]);
    const cachedUnrealizedPnl = useMemo(() => toFiniteNumber(cachedUnrealizedPnlCell), [cachedUnrealizedPnlCell]);
    const cachedUnrealizedPnlPct = useMemo(() => toFiniteNumber(cachedUnrealizedPnlPctCell), [cachedUnrealizedPnlPctCell]);
    const hasPlaceholderPrices = useMemo(() => {
        const stockPlaceholders = Object.values(positions || {}).some((pos) => {
            const qty = Number(pos?.quantity);
            if (!Number.isFinite(qty) || qty === 0) return false;
            const price = Number(pos?.currentPrice);
            return !Number.isFinite(price) || price <= 0;
        });
        if (stockPlaceholders) return true;
        return Object.values(optionPositions || {}).some((opt) => {
            const qty = Number(opt?.quantity);
            if (!Number.isFinite(qty) || qty === 0) return false;
            const price = Number(opt?.currentPrice);
            const marketValue = Number(opt?.marketValue);
            return (!Number.isFinite(price) || price <= 0)
                && (!Number.isFinite(marketValue) || marketValue === 0);
        });
    }, [positions, optionPositions]);
    
    // Check if using seed data
    const isSeedData = useValue(SEED_FLAG_KEY, store) === true;
    
    const confluenceRef = useRef(new Set<string>());
    const waterfallLogRef = useRef<string | null>(null);
    const positionSymbols = useMemo(() => Object.keys(positions || {}), [positions]);
    const hasPositions = useMemo(() => (
        positionSymbols.length > 0 || Object.keys(optionPositions || {}).length > 0
    ), [positionSymbols, optionPositions]);
    const isMarketFresh = useMemo(() => {
        if (!hasPositions) return true;
        if (!lastMarketRefreshTime || !lastPositionsSync) return false;
        return lastMarketRefreshTime >= lastPositionsSync;
    }, [hasPositions, lastMarketRefreshTime, lastPositionsSync]);
    const isPortfolioFresh = Boolean(lastPortfolioSync || lastPositionsSync);
    const isPnlSettled = isPortfolioFresh && isMarketFresh;
    const hasCachedPnl = cachedDailyPnl !== null || cachedUnrealizedPnl !== null;
    const pnlStatus: 'ready' | 'stale' | 'loading' = isPnlSettled
        ? 'ready'
        : ((hasCachedPnl || isPortfolioFresh) ? 'stale' : 'loading');
    const positionsStatus: 'ready' | 'stale' | 'loading' = useMemo(() => {
        if (!hasPositions) {
            return lastPositionsSync ? 'ready' : 'loading';
        }
        if (!lastPositionsSync) return 'stale';
        if (!lastMarketRefreshTime) return 'stale';
        return isMarketFresh ? 'ready' : 'stale';
    }, [hasPositions, isMarketFresh, lastMarketRefreshTime, lastPositionsSync]);
    const marketRefreshAgeMs = useMemo(() => {
        if (!lastMarketRefreshTime) return null;
        return Date.now() - lastMarketRefreshTime;
    }, [lastMarketRefreshTime]);
    const isMarketRefreshStale = marketRefreshAgeMs === null
        ? true
        : marketRefreshAgeMs > STALE_MARKET_REFRESH_MS;
    const positionsSkeleton = positionsStatus === 'loading'
        || (positionsStatus === 'stale' && (hasPlaceholderPrices || isMarketRefreshStale));

    useEffect(() => {
        if (!__DEV__) return;
        if (!lastPositionsSync || !lastMarketRefreshTime) return;
        const portfolioTime = lastPortfolioSync ?? null;
        const base = Math.min(
            portfolioTime ?? lastPositionsSync,
            lastPositionsSync,
            lastMarketRefreshTime
        );
        const lagPortfolio = portfolioTime ? Math.max(0, portfolioTime - base) : null;
        const lagPositions = Math.max(0, lastPositionsSync - base);
        const lagMarket = Math.max(0, lastMarketRefreshTime - base);
        const positionsToMarket = lastMarketRefreshTime - lastPositionsSync;
        const payload = {
            base: new Date(base).toISOString(),
            portfolioSync: portfolioTime ? new Date(portfolioTime).toISOString() : null,
            positionsSync: new Date(lastPositionsSync).toISOString(),
            marketRefresh: new Date(lastMarketRefreshTime).toISOString(),
            lagsMs: {
                portfolio: lagPortfolio,
                positions: lagPositions,
                market: lagMarket
            },
            deltasMs: {
                positionsToMarket: positionsToMarket >= 0 ? positionsToMarket : null
            }
        };
        const key = JSON.stringify(payload);
        if (waterfallLogRef.current === key) return;
        waterfallLogRef.current = key;
    }, [lastPortfolioSync, lastPositionsSync, lastMarketRefreshTime]);
    useAdaptiveMarketRefresh({
        symbols: positionSymbols,
        enabled: marketStatus.isOpen,
        targetWinProb,
        dteWindow: currentDteWindow
    });
    useSpeculativePrefetch(positions, currentRisk, currentDteWindow, true);
    const { totalNetLiq, totalReturn, totalReturnPct } = usePortfolioPerformance(portfolio, positions, optionPositions);
    const netLiqDisplay = Number.isFinite(portfolio.netLiq)
        ? portfolio.netLiq
        : totalNetLiq;
    const buyingPowerDisplay = Number.isFinite(portfolio.buyingPower)
        ? portfolio.buyingPower
        : Number(portfolio.cash ?? 0);
    useEquitySnapshot(netLiqDisplay);
    const availableFundsDisplay = Number.isFinite(Number(portfolio.availableFunds))
        ? Number(portfolio.availableFunds)
        : buyingPowerDisplay;

    const { monthPnL, monthHasSells, yearPnL, yearHasSells } = useRealizedPnL();
    const monthYield = monthHasSells && netLiqDisplay > 0 ? (monthPnL / netLiqDisplay) * 100 : null;
    const yearYield = yearHasSells && netLiqDisplay > 0 ? (yearPnL / netLiqDisplay) * 100 : null;
    const computedDailyPnl = useMemo(() => {
        let total = 0;
        let hasData = false;
        Object.values(positions || {}).forEach((pos) => {
            const close = Number(pos.closePrice);
            const current = Number(pos.currentPrice);
            const qty = Number(pos.quantity) || 0;
            if (!Number.isFinite(close) || !Number.isFinite(current) || qty === 0) return;
            total += (current - close) * qty;
            hasData = true;
        });
        return hasData ? total : null;
    }, [positions]);
    const dayChangeValue: number | null = typeof portfolio.dailyPnl === 'number'
        ? portfolio.dailyPnl
        : computedDailyPnl;
    const dayChangePct: number | null = typeof portfolio.dailyPnlPct === 'number'
        ? portfolio.dailyPnlPct
        : (dayChangeValue !== null && netLiqDisplay > 0
            ? (dayChangeValue / netLiqDisplay) * 100
            : null);
    const bpUsagePct = Number.isFinite(Number(portfolio.bpUsagePct))
        ? Number(portfolio.bpUsagePct)
        : (buyingPowerDisplay > 0 && netLiqDisplay > 0
            ? ((netLiqDisplay - availableFundsDisplay) / netLiqDisplay) * 100
            : null);

    const displayDayChangeValue = isPnlSettled ? dayChangeValue : cachedDailyPnl;
    const displayDayChangePct = isPnlSettled ? dayChangePct : cachedDailyPnlPct;
    const displayTotalReturn = isPnlSettled ? totalReturn : cachedUnrealizedPnl;
    const displayTotalReturnPct = isPnlSettled ? totalReturnPct : cachedUnrealizedPnlPct;

    useEffect(() => {
        if (!isPnlSettled) return;

        const nextDaily = typeof dayChangeValue === 'number' && Number.isFinite(dayChangeValue)
            ? dayChangeValue
            : null;
        const nextDailyPct = typeof dayChangePct === 'number' && Number.isFinite(dayChangePct)
            ? dayChangePct
            : null;
        const nextUnrealized = Number.isFinite(totalReturn) ? totalReturn : null;
        const nextUnrealizedPct = Number.isFinite(totalReturnPct) ? totalReturnPct : null;

        if (nextDaily !== null && nextDaily !== cachedDailyPnl) {
            store.setCell('syncMetadata', 'main', 'lastDailyPnl', nextDaily);
        }
        if (nextDailyPct !== null && nextDailyPct !== cachedDailyPnlPct) {
            store.setCell('syncMetadata', 'main', 'lastDailyPnlPct', nextDailyPct);
        }
        if (nextUnrealized !== null && nextUnrealized !== cachedUnrealizedPnl) {
            store.setCell('syncMetadata', 'main', 'lastUnrealizedPnl', nextUnrealized);
        }
        if (nextUnrealizedPct !== null && nextUnrealizedPct !== cachedUnrealizedPnlPct) {
            store.setCell('syncMetadata', 'main', 'lastUnrealizedPnlPct', nextUnrealizedPct);
        }
    }, [
        isPnlSettled,
        dayChangeValue,
        dayChangePct,
        totalReturn,
        totalReturnPct,
        cachedDailyPnl,
        cachedDailyPnlPct,
        cachedUnrealizedPnl,
        cachedUnrealizedPnlPct
    ]);

    const groupedPositions = useGroupedPositions(sortMode);
    const handleSort = useCallback((key: string) => {
        // Map table keys to PositionSortMode
        // Keys: symbol, dailyPnL, costBasis, marketValue, unrealizedPnL, ccYield, cspYield
        if (['marketValue', 'symbol', 'dailyPnL', 'costBasis', 'unrealizedPnL', 'ccYield', 'cspYield'].includes(key)) {
            Haptics.selectionAsync();
            setSortMode(key as PositionSortMode);
        }
    }, []);
    const handleRefresh = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        
        try {
            // 1. Sync portfolio and positions from IBKR first
            if (user) {
                // console.log('[Dashboard] Syncing portfolio from IBKR...');
                const { syncUserPortfolio } = await import('@/services/trading');
                const syncResult = await syncUserPortfolio();
                
                if (syncResult.data) {
                    // console.log('[Dashboard] Portfolio synced:', syncResult.data);
                    // Store last sync timestamp
                    store.setCell('syncMetadata', 'main', 'lastPortfolioSync', new Date().toISOString());
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    console.warn('[Dashboard] Portfolio sync failed:', syncResult.error);
                    // Continue to refresh market data anyway
                }
            }
            
            // 2. Refresh market data for positions
            const symbols = Object.keys(positions || {});
            if (symbols.length > 0) {
                // console.log('[Dashboard] Refreshing market data for', symbols.length, 'symbols');
                await refreshLiveOptionData(symbols, targetWinProb, currentDteWindow, undefined, {
                    source: 'manual_refresh',
                    logThresholdMs: 3000,
                    skipGreeks: true
                });
                store.setCell('syncMetadata', 'main', 'lastMarketRefresh', new Date().toISOString());
            }
            
            const triggered = evaluateHapticConfluence();
            if (triggered) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            console.error('[Dashboard] Error during refresh:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setRefreshing(false);
        }
    };

    const marketDetailLabel = marketStatus.detailLabel;
    const dteRange = useMemo(() => getDteWindowRange(currentDteWindow), [currentDteWindow]);
    const preferredOpportunity = useMemo(() => {
        if (!opportunities.length) return null;
        const matching = opportunities.filter((opp) => {
            const days = getDaysToExpiration(opp.expiration);
            return days !== null && days >= dteRange.minDays && days <= dteRange.maxDays;
        });
        const pool = matching.length ? matching : opportunities;
        const sorted = [...pool].sort((a, b) => {
            const aYield = typeof a.annualizedYield === 'number' ? a.annualizedYield : -Infinity;
            const bYield = typeof b.annualizedYield === 'number' ? b.annualizedYield : -Infinity;
            if (aYield !== bYield) return bYield - aYield;
            const aPriority = typeof a.priority === 'number' ? a.priority : 99;
            const bPriority = typeof b.priority === 'number' ? b.priority : 99;
            return aPriority - bPriority;
        });
        return sorted[0] ?? null;
    }, [opportunities, dteRange.minDays, dteRange.maxDays]);
    const evaluateHapticConfluence = useCallback(() => {
        const nextKeys: string[] = [];
        Object.values(positions || {}).forEach((pos) => {
            const symbol = typeof pos.symbol === 'string' ? pos.symbol.toUpperCase() : '';
            const rsi = Number(pos.rsi);
            if (!symbol || !Number.isFinite(rsi)) return;
            if (rsi <= 30) {
                const key = `rsi:${symbol}`;
                if (!confluenceRef.current.has(key)) {
                    nextKeys.push(key);
                }
            }
        });

        if (preferredOpportunity) {
            const winProb = typeof preferredOpportunity.winProb === 'number' ? preferredOpportunity.winProb : null;
            const histWin = typeof preferredOpportunity.context?.historicalWinRate === 'number'
                ? preferredOpportunity.context.historicalWinRate
                : null;
            const winProbThreshold = Math.max(80, targetWinProb + 5);
            const isSignature = (winProb !== null && winProb >= winProbThreshold)
                || (histWin !== null && histWin >= 80);
            if (isSignature) {
                const key = `signature:${preferredOpportunity.symbol}-${preferredOpportunity.strategy}`;
                if (!confluenceRef.current.has(key)) {
                    nextKeys.push(key);
                }
            }
        }

        if (nextKeys.length === 0) return false;
        nextKeys.forEach((key) => confluenceRef.current.add(key));
        return true;
    }, [positions, preferredOpportunity, targetWinProb]);

    const listPaddingBottom = insets.bottom + (isIPad ? Theme.spacing.lg : Theme.spacing.xxl + Theme.spacing.md);
    const listContentStyle = useMemo(() => ({
        paddingBottom: listPaddingBottom,
        paddingHorizontal: isIPad ? Theme.spacing.lg : 0,
    }), [listPaddingBottom, isIPad]);
    const listHeaderContent = (
        <DashboardSummarySection
            isIPad={isIPad}
            positions={positions}
            optionPositions={optionPositions}
            netLiqDisplay={netLiqDisplay}
            dayChangePct={displayDayChangePct}
            monthYield={monthYield}
            yearYield={yearYield}
            availableFundsDisplay={availableFundsDisplay}
            bpUsagePct={bpUsagePct}
            isSeedData={isSeedData}
            dayChangeValue={displayDayChangeValue}
            totalReturn={displayTotalReturn}
            totalReturnPct={displayTotalReturnPct}
            pnlStatus={pnlStatus}
            positionsStatus={positionsSkeleton ? 'loading' : positionsStatus}
            groupedPositions={groupedPositions}
            sortMode={sortMode}
            onSort={handleSort}
        />
    );

    return (
        <ScreenLayout
            title="Portfolio"
            subtitleElement={
                <>
                    <BridgeStatus />
                    <MarketStatusPill isOpen={marketStatus.isOpen} />
                    <View style={styles.marketDetailPill}>
                        <Text style={styles.marketDetailText}>
                            {marketDetailLabel}
                        </Text>
                    </View>
                </>
            }
            headerContainerStyle={isIPad ? styles.ipadHeader : undefined}
            rightElement={
                <View style={styles.headerRight}>
                    <FreshnessIndicator 
                        lastUpdated={lastMarketRefresh} 
                        isRefreshing={refreshing}
                    />
                </View>
            }
        >
            <EducationModal
                visible={showOnboarding}
                onClose={markOnboardingSeen}
            />

            <ScrollView
                contentContainerStyle={listContentStyle}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={Theme.colors.primary}
                    />
                }
            >
                {listHeaderContent}
            </ScrollView>

            <StrategyExplainer
                isVisible={!!selectedOpp}
                onClose={() => setSelectedOpp(null)}
                tradeContext={selectedOpp && selectedOpp.symbol ? {
                    symbol: selectedOpp.symbol,
                    strategy: selectedOpp.strategy || 'Unknown',
                    strike: selectedOpp.strike || 0,
                    expiration: selectedOpp.expiration || '',
                    premium: selectedOpp.premium || 0
                } : undefined}
            />
        </ScreenLayout>
    );
}
