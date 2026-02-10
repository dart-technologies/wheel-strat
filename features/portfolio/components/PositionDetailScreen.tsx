import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from 'expo-haptics';
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedLayout from "@/components/AnimatedLayout";
import WheelActionDetailModal from "@/features/portfolio/components/WheelActionDetailModal";
import { HISTORICAL_DATA, LIVE_REFRESH_COOLDOWN_MS } from "@/features/portfolio/components/positionDetail/constants";
import { useOptionPositionsForSymbol, usePosition } from "@/features/portfolio/hooks";
import { refreshLiveOptionData } from "@/data/marketData";
import { getHistoricalBarsCached } from "@/services/marketHistory";
import { useDteWindow, useRiskProfile } from "@/features/settings/hooks";
import { Theme } from "@/constants/theme";
import { getTargetWinProb } from "@/utils/risk";
import { RiskLevel, DteWindow, OptionPosition } from "@wheel-strat/shared";
import { Analytics } from "@/services/analytics";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { useMarketCalendar } from "@/hooks/useMarketCalendar";
import { styles } from "@/features/portfolio/components/positionDetail/styles";
import { PositionDetailHeader } from "@/features/portfolio/components/positionDetail/PositionDetailHeader";
import { WheelActionsSection, type WheelActionItem } from "@/features/portfolio/components/positionDetail/WheelActionsSection";
import { PerformanceChartSection } from "@/features/portfolio/components/positionDetail/PerformanceChartSection";
import { CurrentPositionsSection } from "@/features/portfolio/components/positionDetail/CurrentPositionsSection";
import { PositionEmptyState } from "@/features/portfolio/components/positionDetail/PositionEmptyState";
import { useExecuteOptionOrder } from "@/hooks/useExecuteOptionOrder";

export default function PositionDetailScreen() {
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const router = useRouter();
    const symbolKey = typeof symbol === 'string' ? symbol.toUpperCase() : '';
    const [selectedActionType, setSelectedActionType] = useState<'CC' | 'CSP' | null>(null);
    const [rangeLabel, setRangeLabel] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX'>('1Y');
    const [refreshingLive, setRefreshingLive] = useState(false);
    const [lastLiveRefresh, setLastLiveRefresh] = useState<Date | null>(null);
    const [lastLiveAttempt, setLastLiveAttempt] = useState<Date | null>(null);
    const [lastLiveSettings, setLastLiveSettings] = useState<{ riskLevel: RiskLevel; dteWindow: DteWindow } | null>(null);
    const marketStatus = useMarketStatus();
    const { executeOptionOrder } = useExecuteOptionOrder();
    const [historicalBars, setHistoricalBars] = useState<any[] | null>(null);
    const [historicalSource, setHistoricalSource] = useState<
        'db' | 'fallback' | 'local' | 'cache-warm' | 'cache-cold' | 'bridge' | 'unknown' | null
    >(null);
    const [historicalLoading, setHistoricalLoading] = useState(false);
    const position = usePosition(symbol);
    const optionPositionsForSymbol = useOptionPositionsForSymbol(symbol);
    const currentCallOption = useMemo(() => (
        optionPositionsForSymbol.find((option) => {
            const right = (option.right || '').toUpperCase();
            const quantity = Number(option.quantity) || 0;
            return right === 'C' && quantity < 0;
        }) || null
    ), [optionPositionsForSymbol]);
    const currentPutOption = useMemo(() => (
        optionPositionsForSymbol.find((option) => {
            const right = (option.right || '').toUpperCase();
            const quantity = Number(option.quantity) || 0;
            return right === 'P' && quantity < 0;
        }) || null
    ), [optionPositionsForSymbol]);
    const { currentRisk } = useRiskProfile();
    const { currentDteWindow } = useDteWindow();
    const { events: calendarEvents } = useMarketCalendar(7);
    const refreshGuard = useRef(false);

    // Freshness Logic
    const freshness = useDataFreshness(lastLiveRefresh);
    const calendarMarkers = useMemo(() => {
        if (!symbolKey) return [];
        return calendarEvents
            .filter((event) => {
                if (!event) return false;
                if (Array.isArray(event.symbols) && event.symbols.length > 0) {
                    return event.symbols.includes(symbolKey);
                }
                return true;
            })
            .map((event) => ({
                date: event.date,
                label: event.event || event.holiday || 'Market Event',
                impact: event.impact || (event.holiday ? 'high' : undefined)
            }));
    }, [calendarEvents, symbolKey]);

    useEffect(() => {
        if (!symbol) return;

        // Track view
        Analytics.logPositionView(symbol);
    }, [symbol]);

    useEffect(() => {
        if (!symbolKey) return;
        let cancelled = false;

        const loadHistorical = async () => {
            setHistoricalLoading(true);
            try {
                const warmResult = await getHistoricalBarsCached(symbolKey, {
                    limit: 30,
                    tier: 'warm',
                    allowStale: true
                });
                if (cancelled) return;
                if (Array.isArray(warmResult?.bars) && warmResult?.bars.length > 0) {
                    setHistoricalBars(warmResult.bars);
                    setHistoricalSource(warmResult.source ?? 'cache-warm');
                }

                const coldResult = await getHistoricalBarsCached(symbolKey, {
                    limit: 1260,
                    tier: 'cold',
                    allowStale: true
                });
                if (cancelled) return;
                if (Array.isArray(coldResult?.bars) && coldResult?.bars.length > 0) {
                    setHistoricalBars(coldResult.bars);
                    setHistoricalSource(coldResult.source ?? 'cache-cold');
                } else if (!warmResult?.bars?.length) {
                    setHistoricalBars(null);
                    setHistoricalSource('local');
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('Historical fetch failed, using local fallback:', error);
                    setHistoricalBars(null);
                    setHistoricalSource('local');
                }
            } finally {
                if (!cancelled) setHistoricalLoading(false);
            }
        };

        loadHistorical();
        return () => {
            cancelled = true;
        };
    }, [symbolKey]);

    const refreshLive = useCallback(async (options?: { force?: boolean }) => {
        if (!symbol || refreshGuard.current) return false;
        if (!options?.force && lastLiveAttempt && (Date.now() - lastLiveAttempt.getTime()) < LIVE_REFRESH_COOLDOWN_MS) {
            return false;
        }
        refreshGuard.current = true;
        setLastLiveAttempt(new Date());
        setRefreshingLive(true);
        try {
            const symbolKey = symbol.toUpperCase();
            const { results } = await refreshLiveOptionData([symbol], getTargetWinProb(currentRisk), currentDteWindow, undefined, {
                source: 'position_detail',
                logThresholdMs: 3000,
                skipGreeks: true
            });
            const symbolResult = results.find((item) => item?.symbol === symbolKey);
            if (symbolResult) {
            }
            const hasOptionData = Boolean(symbolResult && (
                Object.prototype.hasOwnProperty.call(symbolResult, 'cc')
                || Object.prototype.hasOwnProperty.call(symbolResult, 'csp')
            ));
            if (hasOptionData) {
                setLastLiveRefresh(new Date());
                setLastLiveSettings({ riskLevel: currentRisk, dteWindow: currentDteWindow });
            }
            return hasOptionData;
        } catch (error) {
            console.error('Error refreshing live option data:', error);
            return false;
        } finally {
            refreshGuard.current = false;
            setRefreshingLive(false);
        }
    }, [symbol, currentRisk, currentDteWindow, lastLiveAttempt]);

    useEffect(() => {
        // Auto-refresh if data is very old (>1hr during market open) or never fetched
        const canAutoRefresh = !lastLiveAttempt
            || (Date.now() - lastLiveAttempt.getTime()) >= LIVE_REFRESH_COOLDOWN_MS;
        if (marketStatus.isOpen && freshness.needsHardRefresh && !refreshingLive && canAutoRefresh) {
            refreshLive();
        }
    }, [freshness.needsHardRefresh, refreshingLive, refreshLive, marketStatus.isOpen, lastLiveAttempt]);



    const stockData = symbol ? HISTORICAL_DATA[symbol] : null;
    const metrics = stockData?.metrics || {};
    const resolvedBars = useMemo(() => {
        if (historicalBars && historicalBars.length > 0) {
            return historicalBars;
        }
        return stockData?.bars || [];
    }, [historicalBars, stockData]);
    const rangeOptions: ('1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX')[] = ['1D', '1W', '1M', '3M', '1Y', 'MAX'];
    const rangeIndex = Math.max(0, rangeOptions.indexOf(rangeLabel));
    const chartBars = useMemo(() => {
        if (!resolvedBars?.length) return [];
        if (rangeLabel === '1D') return resolvedBars.slice(-1);
        if (rangeLabel === '1W') return resolvedBars.slice(-5);
        if (rangeLabel === '1M') return resolvedBars.slice(-21);
        if (rangeLabel === '3M') return resolvedBars.slice(-63);
        if (rangeLabel === '1Y') return resolvedBars.slice(-252);
        return resolvedBars;
    }, [rangeLabel, resolvedBars]);

    const historicalTierLabel = historicalSource === 'db'
        ? 'Hist · DB'
        : historicalSource === 'fallback'
            ? 'Hist · Fallback'
            : historicalSource === 'cache-warm'
                ? 'Hist · Warm'
                : historicalSource === 'cache-cold'
                    ? 'Hist · Cold'
                    : historicalSource === 'bridge'
                        ? 'Hist · Bridge'
                        : 'Historical';

    if (!position || !symbol) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <PositionEmptyState onBack={() => router.back()} />
            </SafeAreaView>
        );
    }

    const toNumber = (value: unknown) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const quantity = toNumber(position.quantity) ?? 0;
    const avgCost = toNumber(position.averageCost) ?? 0;
    const currentPrice = toNumber(position.currentPrice) ?? 0;
    const marketValue = quantity * currentPrice;
    const totalReturn = (currentPrice - avgCost) * quantity;
    const totalReturnPct = (avgCost > 0 && quantity !== 0) ? (totalReturn / (Math.abs(quantity) * avgCost)) * 100 : 0;
    const formatPercent = (value?: number, digits = 1) => (
        typeof value === 'number' ? `${value.toFixed(digits)}%` : '--'
    );
    const formatWinProbLabel = (actual?: number, target?: number) => (
        typeof actual === 'number' && Number.isFinite(actual)
            ? `${Math.round(actual)}% Prob`
            : typeof target === 'number'
                ? `Target ${target}%`
                : '--'
    );
    const formatWinProbDetail = (actual?: number, target?: number) => (
        typeof actual === 'number' && Number.isFinite(actual)
            ? `${Math.round(actual)}%`
            : typeof target === 'number'
                ? `Target ${target}%`
                : '--'
    );
    const targetWinProb = getTargetWinProb(currentRisk);
    const hasValidWinProb = (value?: number) => (
        typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100
    );

    const ccLeg = {
        yieldValue: toNumber(position.ccYield),
        premium: toNumber(position.ccPremium),
        premiumSource: typeof position.ccPremiumSource === 'string' ? position.ccPremiumSource : undefined,
        winProb: toNumber(position.ccWinProb),
        strike: toNumber(position.ccStrike),
        expiration: typeof position.ccExpiration === 'string' ? position.ccExpiration : undefined,
        delta: toNumber(position.ccDelta),
        gamma: toNumber(position.ccGamma),
        theta: toNumber(position.ccTheta),
        vega: toNumber(position.ccVega),
    };
    const cspLeg = {
        yieldValue: toNumber(position.cspYield),
        premium: toNumber(position.cspPremium),
        premiumSource: typeof position.cspPremiumSource === 'string' ? position.cspPremiumSource : undefined,
        winProb: toNumber(position.cspWinProb),
        strike: toNumber(position.cspStrike),
        expiration: typeof position.cspExpiration === 'string' ? position.cspExpiration : undefined,
        delta: toNumber(position.cspDelta),
        gamma: toNumber(position.cspGamma),
        theta: toNumber(position.cspTheta),
        vega: toNumber(position.cspVega),
    };
    const ccHasWinProb = hasValidWinProb(ccLeg.winProb);
    const cspHasWinProb = hasValidWinProb(cspLeg.winProb);
    const ccWinProbLabel = formatWinProbLabel(ccLeg.winProb, targetWinProb);
    const cspWinProbLabel = formatWinProbLabel(cspLeg.winProb, targetWinProb);
    const ccWinProbDetail = formatWinProbDetail(ccLeg.winProb, targetWinProb);
    const cspWinProbDetail = formatWinProbDetail(cspLeg.winProb, targetWinProb);
    const ccIsLive = typeof ccLeg.yieldValue === 'number'
        && typeof ccLeg.premium === 'number'
        && typeof ccLeg.strike === 'number'
        && typeof ccLeg.expiration === 'string';
    const cspIsLive = typeof cspLeg.yieldValue === 'number'
        && typeof cspLeg.premium === 'number'
        && typeof cspLeg.strike === 'number'
        && typeof cspLeg.expiration === 'string';

    const actions: WheelActionItem[] = [
        {
            type: 'CC',
            title: 'Sell Covered Call',
            desc: `Yield income on your ${quantity} shares`,
            icon: 'trending-up',
            iconColor: Theme.colors.strategyCc,
            yieldValue: ccLeg.yieldValue,
            yield: formatPercent(ccLeg.yieldValue),
            winProb: ccWinProbDetail,
            winProbLabel: ccWinProbLabel,
            winProbIsTarget: !ccHasWinProb,
            strategy: 'Covered Call',
            strike: ccLeg.strike || 0,
            expiration: ccLeg.expiration || '--',
            premium: ccLeg.premium || 0,
            premiumSource: ccLeg.premiumSource,
            greeks: {
                delta: ccLeg.delta,
                gamma: ccLeg.gamma,
                theta: ccLeg.theta,
                vega: ccLeg.vega,
            },
            isLive: ccIsLive
        },
        {
            type: 'CSP',
            title: 'Sell Cash-Secured Put',
            desc: 'Acquire more shares at a discount',
            icon: 'trending-down',
            iconColor: Theme.colors.strategyCsp,
            yieldValue: cspLeg.yieldValue,
            yield: formatPercent(cspLeg.yieldValue),
            winProb: cspWinProbDetail,
            winProbLabel: cspWinProbLabel,
            winProbIsTarget: !cspHasWinProb,
            strategy: 'Cash-Secured Put',
            strike: cspLeg.strike || 0,
            expiration: cspLeg.expiration || '--',
            premium: cspLeg.premium || 0,
            premiumSource: cspLeg.premiumSource,
            greeks: {
                delta: cspLeg.delta,
                gamma: cspLeg.gamma,
                theta: cspLeg.theta,
                vega: cspLeg.vega,
            },
            isLive: cspIsLive
        }
    ];
    const selectedAction = selectedActionType
        ? actions.find((action) => action.type === selectedActionType)
        : null;
    const isLiveFresh = lastLiveRefresh
        ? (Date.now() - lastLiveRefresh.getTime()) < 5 * 60 * 1000
        : false;
    const liveSettingsMatch = lastLiveSettings
        ? lastLiveSettings.riskLevel === currentRisk && lastLiveSettings.dteWindow === currentDteWindow
        : false;
    const isLiveFreshForSettings = isLiveFresh && liveSettingsMatch;

    const handleReviewTrade = async (actionType: 'CC' | 'CSP') => {
        if (refreshingLive) {
            setSelectedActionType(actionType);
            return;
        }
        const needsRefresh = !isLiveFreshForSettings;
        setSelectedActionType(actionType);
        if (needsRefresh) {
            void refreshLive({ force: true });
        }
    };

    const handleCloseOption = useCallback((option: OptionPosition) => {
        const quantityValue = Math.abs(Number(option.quantity) || 0);
        const right = (option.right || '').toUpperCase();
        const strike = Number(option.strike);
        const expiration = typeof option.expiration === 'string' ? option.expiration : '';
        const limitPrice = Math.abs(Number(option.currentPrice ?? option.averageCost ?? 0));
        if (!symbol || !quantityValue || !right || !Number.isFinite(strike) || !expiration) return;

        executeOptionOrder({
            symbol,
            action: 'BUY',
            quantity: quantityValue,
            right: right === 'C' ? 'C' : 'P',
            strike,
            expiration,
            limitPrice: Number.isFinite(limitPrice) && limitPrice > 0 ? limitPrice : 0.01
        }, {
            confirmTitle: 'Confirm Close',
            confirmActionLabel: 'Close Position',
            source: 'Position Close'
        });
    }, [executeOptionOrder, symbol]);

    const handleRollOption = useCallback((option: OptionPosition) => {
        const right = (option.right || '').toUpperCase();
        const actionType: 'CC' | 'CSP' = right === 'P' ? 'CSP' : 'CC';
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleReviewTrade(actionType);
    }, [handleReviewTrade]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AnimatedLayout>
                <PositionDetailHeader symbol={symbol} onBack={() => router.back()} />

                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <CurrentPositionsSection
                        symbol={symbol}
                        quantity={quantity}
                        avgCost={avgCost}
                        currentPrice={currentPrice}
                        marketValue={marketValue}
                        totalReturn={totalReturn}
                        totalReturnPct={totalReturnPct}
                        optionPositions={optionPositionsForSymbol}
                        onCloseOption={handleCloseOption}
                        onRollOption={handleRollOption}
                    />

                    <WheelActionsSection
                        actions={actions}
                        quantity={quantity}
                        marketOpen={marketStatus.isOpen}
                        freshness={freshness}
                        onReviewTrade={handleReviewTrade}
                    />

                    <PerformanceChartSection
                        rangeOptions={rangeOptions}
                        rangeIndex={rangeIndex}
                        onRangeChange={(index) => {
                            const next = rangeOptions[index];
                            if (next) {
                                Haptics.selectionAsync();
                                setRangeLabel(next);
                            }
                        }}
                        chartBars={chartBars}
                        symbol={symbol}
                        avgCost={avgCost}
                        historicalLoading={historicalLoading}
                        historicalTierLabel={historicalTierLabel}
                        support={metrics.support}
                        resistance={metrics.resistance}
                        events={calendarMarkers}
                    />

                </ScrollView>

                {/* Detail Modal */}
                {selectedAction && (
                    <WheelActionDetailModal
                        isVisible={true}
                        onClose={() => setSelectedActionType(null)}
                        symbol={symbol}
                        strategy={selectedAction.strategy}
                        strike={selectedAction.strike}
                        expiration={selectedAction.expiration}
                        premium={selectedAction.premium}
                        yield={selectedAction.yield}
                        winProb={selectedAction.winProb}
                        greeks={selectedAction.greeks}
                        currentOption={(selectedAction.type === 'CC' ? currentCallOption : currentPutOption) ?? undefined}
                        underlyingPrice={currentPrice}
                    />
                )}
            </AnimatedLayout>
        </SafeAreaView>
    );
}
