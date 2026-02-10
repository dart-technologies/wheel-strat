import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedLayout from "@/components/AnimatedLayout";
import GlassCard from "@/components/GlassCard";
import GreeksDashboard from "@/components/GreeksDashboard";
import { Skeleton } from "@/components/Skeleton";
import { Theme } from "@/constants/theme";
import OpportunityActionBar from "@/features/opportunities/components/opportunityDetail/OpportunityActionBar";
import OpportunityHeroCard from "@/features/opportunities/components/opportunityDetail/OpportunityHeroCard";
import OpportunityTechnicalCard from "@/features/opportunities/components/opportunityDetail/OpportunityTechnicalCard";
import { useMarketOpportunities } from "@/features/opportunities/hooks";
import { useDteWindow, useRiskProfile } from "@/features/settings/hooks";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { useAuth } from "@/hooks/useAuth";
import { useMarketCalendar } from "@/hooks/useMarketCalendar";
import { styles } from "@/features/opportunities/components/opportunityDetail/styles";
import { Opportunity } from "@wheel-strat/shared";
import { formatCurrency, formatPercent } from "@/utils/format";
import { getDteWindowRange } from "@/utils/settings";
import { getDaysToExpiration } from "@/utils/time";
import mag7Historical from "@/assets/data/mag7_historical_1y.json";
import { useExecuteOpportunity } from "@/hooks/useExecuteOpportunity";

type Mag7Snapshot = {
    symbol: string;
    bars: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
    metrics?: {
        support?: number;
        resistance?: number;
        yearHigh?: number;
        yearLow?: number;
    };
    lastUpdated?: string;
};

const MAG7_HISTORY = mag7Historical as Record<string, Mag7Snapshot>;

const formatOptionalPercent = (value?: number, digits = 1) => (
    typeof value === "number" && Number.isFinite(value) ? formatPercent(value, digits) : "--"
);

const formatOptionalCurrency = (value?: number) => (
    typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "--"
);

export default function OpportunityDetailScreen() {
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { marketOpportunities, loading } = useMarketOpportunities(symbol);
    const [opp, setOpp] = useState<Opportunity | null>(null);
    const { events: calendarEvents } = useMarketCalendar(7);

    const { isAuthenticated } = useAuth();
    const { currentRisk } = useRiskProfile();
    const { currentDteWindow } = useDteWindow();
    const { executeOpportunity, executing } = useExecuteOpportunity();

    const freshness = useDataFreshness(opp?.createdAt as any);
    const isCoveredCall = Boolean(opp?.strategy?.toLowerCase().includes("call"));
    const strategyColor = isCoveredCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;

    useEffect(() => {
        if (!marketOpportunities.length) {
            setOpp(null);
            return;
        }
        const sorted = [...marketOpportunities].sort((a, b) => (a.priority || 99) - (b.priority || 99));
        setOpp(sorted[0] || null);
    }, [marketOpportunities]);

    const dteRange = useMemo(() => getDteWindowRange(currentDteWindow), [currentDteWindow]);
    const dte = useMemo(() => getDaysToExpiration(opp?.expiration), [opp?.expiration]);
    const dteMatch = dte !== null && dte >= dteRange.minDays && dte <= dteRange.maxDays;

    const symbolKey = typeof symbol === "string" ? symbol.toUpperCase() : "";
    const mag7Snapshot = useMemo(() => (symbolKey ? MAG7_HISTORY[symbolKey] : undefined), [symbolKey]);
    const historicalBars = useMemo(
        () => (mag7Snapshot?.bars ?? []).map((bar: any) => ({
            date: bar.date,
            close: bar.close,
            volume: bar.volume
        })),
        [mag7Snapshot]
    );
    const hasHistorical = historicalBars.length > 0;
    const catalystEvents = useMemo(() => {
        const catalysts = opp?.analysis?.catalysts;
        if (!catalysts) return [];
        if (Array.isArray(catalysts)) {
            return catalysts
                .filter((catalyst) => Boolean(catalyst?.date))
                .map((catalyst) => ({
                    date: catalyst.date as string,
                    label: catalyst.event,
                    impact: catalyst.impact
                }));
        }
        const events: { date: string; label?: string; impact?: string }[] = [];
        if (catalysts.earnings) {
            events.push({ date: catalysts.earnings, label: "Earnings", impact: "high" });
        }
        if (Array.isArray(catalysts.events)) {
            catalysts.events.forEach((event) => {
                if (event) {
                    events.push({ date: event, label: "Event" });
                }
            });
        }
        return events;
    }, [opp?.analysis?.catalysts]);
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
    const chartEvents = useMemo(() => {
        const merged = new Map<string, { date: string; label?: string; impact?: string }>();
        [...catalystEvents, ...calendarMarkers].forEach((event) => {
            if (!event?.date) return;
            const label = event.label || 'Market Event';
            const key = `${event.date}-${label}`;
            if (!merged.has(key)) {
                merged.set(key, { date: event.date, label, impact: event.impact });
            }
        });
        return Array.from(merged.values());
    }, [catalystEvents, calendarMarkers]);

    const patternLabel = useMemo(() => {
        const rawPattern = opp?.analysis?.technicals?.pattern;
        if (!rawPattern) return null;
        if (typeof rawPattern === "string") return rawPattern;
        if (typeof rawPattern === "object" && "pattern" in rawPattern) {
            return String((rawPattern as { pattern?: string }).pattern || '').trim() || null;
        }
        return null;
    }, [opp?.analysis?.technicals?.pattern]);

    const annualizedYieldText = formatOptionalPercent(opp?.annualizedYield, 1);
    const winProbText = formatOptionalPercent(opp?.winProb, 0);
    const premiumText = formatOptionalCurrency(opp?.premium);
    const ivRankText = Number.isFinite(opp?.ivRank) && (opp?.ivRank ?? 0) > 0
        ? `${opp?.ivRank}`
        : "--";
    const impliedVolText = formatOptionalPercent(opp?.impliedVol, 1);
    const dteLabel = dte !== null ? `${dte}d` : "--";
    const autoReady = Boolean(!freshness.isStale && dteMatch && typeof opp?.winProb === "number" && opp.winProb >= 70);

    const headerTitle = typeof symbol === "string" && symbol.length > 0
        ? `${symbol} Opportunity`
        : "Opportunity";

    const actionBarHeight = 72 + insets.bottom;
    const horizontalPadding = width < 360 ? Theme.spacing.md : Theme.layout.pagePadding;
    const contentContainerStyle = useMemo(() => ([
        styles.contentContainer,
        { paddingHorizontal: horizontalPadding, paddingBottom: actionBarHeight + Theme.spacing.lg },
    ]), [actionBarHeight, horizontalPadding]);
    const actionBarStyle = useMemo(() => ([
        styles.actionBar,
        { paddingBottom: insets.bottom + Theme.spacing.sm, paddingHorizontal: horizontalPadding },
    ]), [insets.bottom, horizontalPadding]);

    const handleExecute = useCallback(() => {
        if (!opp) return;
        executeOpportunity(opp, { source: "Detail Execution" });
    }, [opp, executeOpportunity]);

    if (loading && !opp) {
        return (
            <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
                <Stack.Screen options={{
                    title: headerTitle,
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.closeButton}>
                            <Ionicons name="chevron-down" size={28} color={Theme.colors.text} />
                        </Pressable>
                    ),
                }} />
                <AnimatedLayout>
                    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                        <View style={styles.headerSkeleton}>
                            <View>
                                <Skeleton width={120} height={32} style={styles.skeletonGap} />
                                <Skeleton width={80} height={16} />
                            </View>
                            <View style={styles.skeletonRight}>
                                <Skeleton width={60} height={24} style={styles.skeletonGap} />
                                <Skeleton width={80} height={12} />
                            </View>
                        </View>

                        <View style={styles.actionRow}>
                            <Skeleton width="30%" height={56} borderRadius={Theme.borderRadius.md} />
                            <Skeleton width="65%" height={56} borderRadius={Theme.borderRadius.md} />
                        </View>

                        <GlassCard style={styles.sectionCard} blurIntensity={Theme.blur.medium}>
                            <Skeleton width={100} height={16} style={styles.skeletonGap} />
                            <View style={styles.statsGrid}>
                                <Skeleton width="30%" height={40} />
                                <Skeleton width="30%" height={40} />
                                <Skeleton width="30%" height={40} />
                            </View>
                        </GlassCard>
                    </ScrollView>
                </AnimatedLayout>
            </SafeAreaView>
        );
    }

    if (!opp) {
        return (
            <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
                <Stack.Screen options={{
                    title: headerTitle,
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.closeButton}>
                            <Ionicons name="chevron-down" size={28} color={Theme.colors.text} />
                        </Pressable>
                    ),
                }} />
                <AnimatedLayout>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.bodyText}>
                            Live opportunity unavailable. Check bridge health or market hours.
                        </Text>
                    </View>
                </AnimatedLayout>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
                <Stack.Screen options={{
                    title: headerTitle,
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.closeButton}>
                            <Ionicons name="chevron-down" size={28} color={Theme.colors.text} />
                        </Pressable>
                ),
            }} />

            <AnimatedLayout>
                <View style={styles.screen}>
                    <ScrollView
                        style={styles.container}
                        contentContainerStyle={contentContainerStyle}
                        showsVerticalScrollIndicator={false}
                    >
                        <OpportunityHeroCard
                            opportunity={opp}
                            strategyColor={strategyColor}
                            isStale={freshness.isStale}
                            freshnessLabel={freshness.ageLabel}
                            annualizedYieldText={annualizedYieldText}
                            winProbText={winProbText}
                            dteLabel={dteLabel}
                            premiumText={premiumText}
                            ivRankText={ivRankText}
                            impliedVolText={impliedVolText}
                            dteRangeLabel={dteRange.label}
                            currentRisk={currentRisk}
                            dteMatch={dteMatch}
                            autoReady={autoReady}
                            isCoveredCall={isCoveredCall}
                        />

                        <GreeksDashboard greeks={opp as any} title="Live Greeks" />

                        {freshness.isStale && (
                            <Text style={[styles.staleNotice, { color: Theme.colors.dataStale }]}>
                                Data is over 15m old. Prices may have shifted.
                            </Text>
                        )}

                    <OpportunityTechnicalCard
                        symbol={opp.symbol}
                        hasHistorical={hasHistorical}
                        historicalBars={historicalBars}
                        support={mag7Snapshot?.metrics?.support}
                        resistance={mag7Snapshot?.metrics?.resistance}
                        impliedVol={opp.impliedVol}
                        patternLabel={patternLabel}
                        accentColor={strategyColor}
                        chartEvents={chartEvents}
                        strike={opp.strike}
                        currentPrice={opp.analysis?.currentPrice ?? opp.currentPrice}
                        technicals={opp.analysis?.technicals}
                        metrics={opp.analysis?.metrics}
                    />
                    </ScrollView>

                    <OpportunityActionBar
                        isAuthenticated={isAuthenticated}
                        isCoveredCall={isCoveredCall}
                        executing={executing}
                        strategyColor={strategyColor}
                        onExecute={handleExecute}
                        style={actionBarStyle}
                    />

                </View>
            </AnimatedLayout>
        </SafeAreaView>
    );
}
