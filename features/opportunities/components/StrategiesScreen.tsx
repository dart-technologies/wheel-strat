import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, useEffect } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { useCell } from 'tinybase/ui-react';
import { FlashList } from "@shopify/flash-list";
import { store } from "@/data/store";
import ScreenLayout from "@/components/ScreenLayout";
import DataTierBadge from "@/components/DataTierBadge";
import GlassCard from "@/components/GlassCard";
import BridgeStatus from "@/components/BridgeStatus";
import MarketStatusPill from "@/components/MarketStatusPill";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import SegmentedControl from "@/components/SegmentedControl";
import { SkeletonCard } from "@/components/Skeleton";
import StrategyExplainer from "@/components/StrategyExplainer";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import { Theme } from "@/constants/theme";
import { useOpportunities, useOpportunitySynopsis, useScanPortfolio } from "@/features/opportunities/hooks";
import { useLatestReport, useReport } from "@/features/reports/hooks";
import { usePortfolio } from "@/features/portfolio/hooks";
import { useAnalysisStaleness, useDteWindow, useRiskProfile, useTraderLevel } from "@/features/settings/hooks";
import { Analytics } from "@/services/analytics";
import { Opportunity } from "@wheel-strat/shared";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { getDaysToExpiration } from "@/utils/time";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { formatCompactCurrency, formatCompactPercent } from "@/utils/format";
import { useMarketCalendar } from "@/hooks/useMarketCalendar";
import { useMinuteTicker } from "@/hooks/useMinuteTicker";
import { styles } from "@/features/opportunities/components/strategies/styles";

const FList = FlashList as any;

export default function StrategiesScreen() {
    const { width } = useWindowDimensions();
    const isIPad = width > 768;
    const insets = useSafeAreaInsets();
    const { reportId: reportIdParam } = useLocalSearchParams<{ reportId?: string | string[] }>();
    const reportId = Array.isArray(reportIdParam) ? reportIdParam[0] : reportIdParam;
    const { opportunities } = useOpportunities();
    const { synopsis, loading: synopsisLoading } = useOpportunitySynopsis();
    const { report: reportById, loading: reportByIdLoading } = useReport(reportId);
    const { report: latestReport, loading: latestReportLoading } = useLatestReport(!reportId);
    const report = reportId ? reportById : latestReport;
    const reportLoading = reportId ? reportByIdLoading : latestReportLoading;
    const { scanning, runScan } = useScanPortfolio();
    const { positions, portfolio } = usePortfolio();
    const { currentRisk } = useRiskProfile();
    const { currentTraderLevel } = useTraderLevel();
    const { currentDteWindow } = useDteWindow();
    const { analysisUpdatedAt } = useAnalysisStaleness();
    const { events: calendarEvents } = useMarketCalendar(7);

    // Freshness Logic
    const freshness = useDataFreshness(analysisUpdatedAt);

    const synopsisTier = freshness.isStale ? 'stale' : 'derived';
    const staleAgeLabel = freshness.ageLabel;
    const reportSynopsis = report?.synopsis || synopsis;
    const router = useRouter();
    
    const lastScanStr = useCell('syncMetadata', 'main', 'lastStrategiesScan', store);
    const lastScanTime = lastScanStr ? new Date(String(lastScanStr)) : null;

    const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
    const [activeSegment, setActiveSegment] = useState<'analysis' | 'top1' | 'top2' | 'top3'>('analysis');
    
    useMinuteTicker();

    const marketStatus = useMarketStatus();


    const handleScan = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Analytics.logScanTriggered(currentRisk, {
            traderLevel: currentTraderLevel,
            dteWindow: currentDteWindow,
        });

        const success = await runScan(positions, portfolio);
        if (success) {
            store.setCell('syncMetadata', 'main', 'lastStrategiesScan', new Date().toISOString());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const segmentOptions = useMemo(() => [
        { key: 'analysis' as const, label: '📊' },
        { key: 'top1' as const, label: '🥇' },
        { key: 'top2' as const, label: '🥈' },
        { key: 'top3' as const, label: '🥉' },
    ], []);

    const segmentIndex = Math.max(0, segmentOptions.findIndex((segment) => segment.key === activeSegment));
    const marketDetailLabel = marketStatus.detailLabel;
    const listPaddingBottom = insets.bottom + (isIPad ? Theme.spacing.lg : Theme.spacing.xxl + Theme.spacing.md);
    const listContentStyle = useMemo(() => ({
        paddingBottom: listPaddingBottom,
        paddingHorizontal: isIPad ? Theme.spacing.lg : 0
    }), [listPaddingBottom, isIPad]);

    const filteredOpportunities = useMemo(() => {
        if (activeSegment === 'analysis') return [];
        const index = activeSegment === 'top1' ? 0 : activeSegment === 'top2' ? 1 : 2;
        const opp = opportunities[index];
        return opp ? [opp] : [];
    }, [activeSegment, opportunities]);

    const opportunityTableColumns = useMemo<DataTableColumn[]>(() => {
        if (isIPad) {
            return [
                { key: 'rank', label: 'Rank', align: 'center', flex: 0.6 },
                { key: 'details', label: 'Strategy Details', flex: 1.8 },
                { key: 'premium', label: 'Premium (B/A)', align: 'right', flex: 1 },
                { key: 'win', label: 'Win Prob / Yield', align: 'right', flex: 1.1 },
                { key: 'edge', label: 'Historical Edge', align: 'right', flex: 1 },
            ];
        }
        return [
            { key: 'details', label: 'Strategy', flex: 1.8 },
            { key: 'premium', label: 'Premium', align: 'right', flex: 1 },
            { key: 'win', label: 'Win / Yield', align: 'right', flex: 1 },
        ];
    }, [isIPad]);

    const opportunityTableRows = useMemo(() => {
        return filteredOpportunities.map((opp, index) => {
            const dte = getDaysToExpiration(opp.expiration);
            const rankValue = typeof opp.priority === 'number' ? opp.priority : index + 1;
            const winProbLabel = typeof opp.winProb === 'number' ? `${opp.winProb.toFixed(0)}%` : '—';
            const yieldLabel = typeof opp.annualizedYield === 'number'
                ? formatCompactPercent(opp.annualizedYield, 1)
                : '—';
            const premiumLabel = typeof opp.premium === 'number'
                ? formatCompactCurrency(opp.premium, 2)
                : '—';
            const histWin = typeof opp.context?.historicalWinRate === 'number'
                ? opp.context.historicalWinRate
                : null;
            const histMatches = typeof opp.context?.historicalMatches === 'number'
                ? opp.context.historicalMatches
                : null;

            const rankCell = (
                <Text style={[styles.tablePrimary, styles.tableCenter]}>
                    {rankValue}
                </Text>
            );
            const detailsCell = (
                <View>
                    <Text style={styles.tableSymbol}>{opp.symbol}</Text>
                    <Text style={styles.tableMeta}>
                        {opp.strategy} • ${opp.strike?.toFixed?.(0) ?? '--'} • {dte !== null ? `${dte}d` : opp.expiration}
                    </Text>
                </View>
            );
            const premiumCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>{premiumLabel}</Text>
                    <Text style={styles.tableSecondary}>B/A —</Text>
                </View>
            );
            const winCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>{winProbLabel}</Text>
                    <Text style={styles.tableSecondary}>{yieldLabel}</Text>
                </View>
            );
            const edgeCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                        {histWin !== null ? `${histWin.toFixed(0)}%` : '—'}
                    </Text>
                    <Text style={styles.tableSecondary}>
                        {histMatches !== null ? `${histMatches} matches` : '—'}
                    </Text>
                </View>
            );

            const cells = isIPad
                ? {
                    rank: rankCell,
                    details: detailsCell,
                    premium: premiumCell,
                    win: winCell,
                    edge: edgeCell
                }
                : {
                    details: detailsCell,
                    premium: premiumCell,
                    win: winCell
                };

            return {
                key: `${opp.symbol}-${index}`,
                cells,
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/opportunity/${opp.symbol}`);
                }
            };
        });
    }, [filteredOpportunities, isIPad, router]);

    const calendarKeyDates = useMemo(() => (
        calendarEvents.map((event) => ({
            date: event.date,
            event: event.event || event.holiday || 'Market Event',
            symbols: event.symbols,
            impact: event.impact || (event.holiday ? 'high' : 'medium')
        }))
    ), [calendarEvents]);

    const combinedKeyDates = useMemo(() => {
        const reportDates = report?.keyDates || [];
        const merged = new Map<string, { date: string; event: string; symbols?: string[]; impact?: string }>();

        [...reportDates, ...calendarKeyDates].forEach((item) => {
            if (!item?.date || !item?.event) return;
            const key = `${item.date}-${item.event}`;
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, {
                    date: item.date,
                    event: item.event,
                    symbols: item.symbols?.length ? [...item.symbols] : undefined,
                    impact: item.impact
                });
                return;
            }
            const mergedSymbols = new Set<string>([...(existing.symbols || []), ...(item.symbols || [])]);
            merged.set(key, {
                ...existing,
                symbols: mergedSymbols.size ? Array.from(mergedSymbols) : undefined,
                impact: existing.impact || item.impact
            });
        });

        return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [report?.keyDates, calendarKeyDates]);

    const calendarTableColumns = useMemo<DataTableColumn[]>(() => {
        if (isIPad) {
            return [
                { key: 'date', label: 'Date', flex: 0.8 },
                { key: 'event', label: 'Event', flex: 2 },
                { key: 'impact', label: 'Impact', align: 'center', flex: 0.7 },
                { key: 'symbols', label: 'Symbols', align: 'right', flex: 1 }
            ];
        }
        return [
            { key: 'date', label: 'Date', flex: 0.9 },
            { key: 'event', label: 'Event', flex: 2.1 },
            { key: 'impact', label: 'Impact', align: 'right', flex: 0.7 }
        ];
    }, [isIPad]);

    const calendarTableRows = useMemo(() => {
        return calendarEvents.map((event, index) => {
            const title = event.event || event.holiday || 'Market Event';
            const impact = (event.impact || (event.holiday ? 'high' : 'medium')).toLowerCase();
            const impactLabel = impact.toUpperCase();
            const metaParts = [
                event.market ? event.market.toUpperCase() : null,
                event.earlyClose ? 'Early Close' : null,
                event.isOpen === false ? 'Closed' : null
            ].filter((part): part is string => Boolean(part));
            const metaLabel = metaParts.join(' • ');
            const symbolsLabel = event.symbols?.length ? event.symbols.join(', ') : '—';

            const dateCell = (
                <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                    {event.date}
                </Text>
            );
            const eventCell = (
                <View>
                    <Text style={styles.tablePrimary}>{title}</Text>
                    {metaLabel ? (
                        <Text style={styles.tableSecondary}>{metaLabel}</Text>
                    ) : null}
                    {!isIPad && event.symbols?.length ? (
                        <Text style={styles.tableSecondary}>{event.symbols.join(', ')}</Text>
                    ) : null}
                </View>
            );
            const impactCell = (
                <Text style={[
                    styles.impactBadge,
                    impact === 'high' && styles.impactHigh,
                    impact === 'medium' && styles.impactMedium,
                    impact === 'low' && styles.impactLow
                ]}>
                    {impactLabel}
                </Text>
            );
            const symbolsCell = (
                <Text style={[styles.tableSecondary, Theme.typography.numeric]}>
                    {symbolsLabel}
                </Text>
            );

            const cells = isIPad
                ? {
                    date: dateCell,
                    event: eventCell,
                    impact: impactCell,
                    symbols: symbolsCell
                }
                : {
                    date: dateCell,
                    event: eventCell,
                    impact: impactCell
                };

            return {
                key: `${event.date}-${title}-${index}`,
                cells
            };
        });
    }, [calendarEvents, isIPad]);

    const listHeaderComponent = useMemo(() => (
        <View style={isIPad ? styles.ipadHeader : undefined}>
            <View style={[styles.selectorContainer, isIPad && styles.selectorContainerWide]}>
                <SegmentedControl
                    options={segmentOptions.map((segment) => segment.label)}
                    selectedIndex={segmentIndex}
                    onChange={(index) => {
                        const next = segmentOptions[index];
                        if (next) {
                            Haptics.selectionAsync();
                            setActiveSegment(next.key);
                        }
                    }}
                    style={styles.segmentControl}
                />
            </View>

            {activeSegment === 'analysis' && (
                <View style={styles.analysisSection}>
                    {reportLoading || (synopsisLoading && !report) ? (
                        <SkeletonCard />
                    ) : report ? (
                        <>
                            <GlassCard
                                style={styles.reportCard}
                                contentStyle={styles.reportContent}
                                blurIntensity={Theme.blur.medium}
                            >
                                <View style={styles.reportHeaderRow}>
                                    <Ionicons name="globe-outline" size={20} color={Theme.colors.primary} />
                                    <Text style={styles.reportTitle}>Macro Outlook Analysis</Text>
                                    {synopsisTier !== 'stale' && <DataTierBadge tier={synopsisTier} />}
                                </View>
                                {/* {freshness.isStale && (
                                    <Text style={styles.staleHint}>
                                        Updated {staleAgeLabel}. {freshness.needsHardRefresh ? 'Critical refresh recommended.' : 'Signals may be lagging.'}
                                    </Text>
                                )} */}
                                {report.headline ? (
                                    <Text style={styles.reportHeadline}>{report.headline}</Text>
                                ) : null}
                                {reportSynopsis ? (
                                    <Text style={styles.reportSynopsis}>{reportSynopsis}</Text>
                                ) : null}
                                <Text style={styles.reportBody}>{report.macroAnalysis}</Text>
                                <Text style={styles.reportMeta}>
                                    {report.date} • {report.session === 'open' ? '9:30 AM' : '3:30 PM'}
                                    {report.vixLevel > 0 ? ` • VIX ${report.vixLevel}` : ''}
                                </Text>
                            </GlassCard>

                            {combinedKeyDates.length > 0 && (
                                <GlassCard
                                    style={styles.reportCard}
                                    contentStyle={styles.reportContent}
                                    blurIntensity={Theme.blur.medium}
                                >
                                    <View style={styles.reportHeaderRow}>
                                        <Ionicons name="calendar-outline" size={20} color={Theme.colors.primary} />
                                        <Text style={styles.reportTitle}>Key Calendar Dates</Text>
                                    </View>
                                    {combinedKeyDates.map((date, idx) => {
                                        const impactLabel = date.impact ? date.impact.toUpperCase() : 'MEDIUM';
                                        return (
                                            <View key={`${date.date}-${idx}`} style={styles.dateRow}>
                                                <View>
                                                    <Text style={styles.dateEvent}>{date.event}</Text>
                                                    {date.symbols?.length ? (
                                                        <Text style={styles.dateSymbols}>{date.symbols.join(', ')}</Text>
                                                    ) : null}
                                                    <Text style={styles.dateDate}>{date.date}</Text>
                                                </View>
                                                <Text style={[
                                                    styles.impactBadge,
                                                    date.impact === 'high' && styles.impactHigh,
                                                    date.impact === 'medium' && styles.impactMedium
                                                ]}>
                                                    {impactLabel}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </GlassCard>
                            )}

                            {calendarTableRows.length > 0 && (
                                <GlassCard
                                    style={styles.reportCard}
                                    contentStyle={styles.reportContent}
                                    blurIntensity={Theme.blur.medium}
                                >
                                    <View style={styles.reportHeaderRow}>
                                        <Ionicons name="calendar-outline" size={20} color={Theme.colors.primary} />
                                        <Text style={styles.reportTitle}>Market Calendar (7D)</Text>
                                    </View>
                                    <DataTable columns={calendarTableColumns} rows={calendarTableRows} />
                                </GlassCard>
                            )}
                        </>
                    ) : reportSynopsis ? (
                        <GlassCard
                            style={[styles.synopsisCard]}
                            contentStyle={styles.synopsisContent}
                            blurIntensity={Theme.blur.medium}
                            isStale={freshness.isStale}
                        >
                            <View style={styles.synopsisHeader}>
                                <Ionicons name="analytics" size={20} color={Theme.colors.primary} />
                                <Text style={styles.synopsisHeaderTitle}>Macro Outlook</Text>
                                {synopsisTier !== 'stale' && <DataTierBadge tier={synopsisTier} />}
                            </View>
                            {/* {freshness.isStale && (
                                <Text style={styles.staleHint}>
                                    Updated {staleAgeLabel}. {freshness.needsHardRefresh ? 'Critical refresh recommended.' : 'Signals may be lagging.'}
                                </Text>
                            )} */}
                            <Text style={styles.synopsisText}>{reportSynopsis}</Text>
                        </GlassCard>
                    ) : (
                        <GlassCard style={styles.infoCard} contentStyle={styles.infoContent} blurIntensity={Theme.blur.medium}>
                            <Ionicons name="information-circle-outline" size={24} color={Theme.colors.primary} />
                            <Text style={styles.infoText}>
                                No analysis available. Tap the sparkles icon in the header to run a new scan.
                            </Text>
                        </GlassCard>
                    )}

                    {/* Top 3 opportunities now live in the segmented control slots */}
                </View>
            )}
            {activeSegment !== 'analysis' && (
                <View style={styles.tableWrapper}>
                    {opportunityTableRows.length > 0 ? (
                        <DataTable columns={opportunityTableColumns} rows={opportunityTableRows} />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No opportunity found for this rank.</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    ), [
        isIPad,
        segmentOptions,
        segmentIndex,
        activeSegment,
        opportunityTableColumns,
        opportunityTableRows,
        calendarTableColumns,
        calendarTableRows,
        synopsisLoading,
        reportLoading,
        report,
        combinedKeyDates,
        reportSynopsis,
        synopsisTier,
        freshness.isStale,
        freshness.needsHardRefresh,
        staleAgeLabel
    ]);

    return (
        <ScreenLayout
            title="Strategies"
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
            delay={100}
            headerContainerStyle={isIPad ? styles.ipadHeader : undefined}
            rightElement={
                <View style={styles.headerRight}>
                    <FreshnessIndicator 
                        lastUpdated={lastScanTime || analysisUpdatedAt} 
                        isRefreshing={scanning}
                    />
                </View>
            }
        >
            <FList
                data={[] as any}
                renderItem={() => null}
                ListHeaderComponent={listHeaderComponent}
                contentContainerStyle={listContentStyle}
                showsVerticalScrollIndicator={false}
                estimatedItemSize={600}
                refreshing={scanning}
                onRefresh={handleScan}
            />

            {selectedOpp && (
                <StrategyExplainer
                    isVisible={!!selectedOpp}
                    onClose={() => setSelectedOpp(null)}
                    tradeContext={{
                        symbol: selectedOpp.symbol,
                        strategy: selectedOpp.strategy,
                        strike: selectedOpp.strike,
                        expiration: selectedOpp.expiration,
                        premium: selectedOpp.premium
                    }}
                />
            )}
        </ScreenLayout>
    );
}

