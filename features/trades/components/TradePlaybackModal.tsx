import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trade } from '@wheel-strat/shared';
import { Theme } from '@/constants/theme';
import GlassCard from '@/components/GlassCard';
import HistoricalChart from '@/components/HistoricalChart';
import DataTierBadge, { type DataTier } from '@/components/DataTierBadge';
import PayoffGlyph from '@/components/PayoffGlyph';
import { getHistoricalBarsCached } from '@/services/marketHistory';
import { formatCurrency, formatCompactCurrency } from '@/utils/format';
import { getStrategyColor } from '@/utils/strategies';

type TradePlaybackModalProps = {
    visible: boolean;
    trade: Trade | null;
    onClose: () => void;
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const parseTradeDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));

const resolveTier = (source: string | null, isStale: boolean): DataTier | null => {
    if (!source) return null;
    if (isStale) return 'stale';
    if (source === 'fallback') return 'mocked';
    return 'derived';
};

const resolveTierLabel = (source: string | null, isStale: boolean) => {
    if (!source) return undefined;
    if (isStale) return 'STALE';
    const labels: Record<string, string> = {
        'cache-warm': 'CACHE',
        'cache-cold': 'ARCHIVE',
        db: 'DB',
        bridge: 'BRIDGE',
        fallback: 'FALLBACK',
        unknown: 'UNKNOWN'
    };
    return labels[source] || 'DERIVED';
};

const isOptionTrade = (trade: Trade) => {
    const secType = trade.secType ? trade.secType.toUpperCase() : '';
    if (secType === 'OPT') return true;
    const strikeValue = Number(trade.strike);
    const hasStrike = Number.isFinite(strikeValue) && strikeValue > 0;
    return Boolean(trade.right || hasStrike || trade.expiration);
};

const resolveActionLabel = (trade: Trade) => {
    const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, any> : undefined;
    const toUpper = (v?: any) => String(v || '').toUpperCase();
    
    const type = toUpper(trade.type);
    const right = toUpper(trade.right || raw?.right);
    const secType = toUpper(trade.secType || raw?.secType);
    const action = toUpper(raw?.action);
    
    const isOption = secType === 'OPT' || type === 'CC' || type === 'CSP' || !!right;
    
    let label = '';
    const sourceAction = action || type;
    
    if (sourceAction === 'ROLL') label = 'Roll';
    else if (sourceAction === 'CLOSE') label = 'Close';
    else if (sourceAction === 'OPEN') label = 'Open';
    else if (['SELL', 'SLD'].includes(sourceAction)) label = 'Sell';
    else if (['BUY', 'BOT'].includes(sourceAction)) label = 'Buy';
    else label = sourceAction.charAt(0) + sourceAction.slice(1).toLowerCase();

    // Determine strategy suffix
    let strategy = '';
    if (type === 'CC' || right === 'C') strategy = 'CC';
    else if (type === 'CSP' || right === 'P') strategy = 'CSP';

    if (isOption && strategy) {
        return `${label} ${strategy}`;
    }
    return label;
};

export default function TradePlaybackModal({ visible, trade, onClose }: TradePlaybackModalProps) {
    const [bars, setBars] = useState<any[]>([]);
    const [source, setSource] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !trade?.symbol) return;
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            setBars([]);
            setSource(null);
            setIsStale(false);
            const entryDate = parseTradeDate(trade.date) ?? new Date();
            const startDate = formatDate(addDays(entryDate, -60));
            const endDate = formatDate(addDays(entryDate, 60));
            const today = formatDate(new Date());
            const resolvedEnd = endDate > today ? today : endDate;

            try {
                const warmResult = await getHistoricalBarsCached(trade.symbol, {
                    startDate,
                    endDate: resolvedEnd,
                    tier: 'warm',
                    allowStale: true
                });
                if (cancelled) return;
                if (Array.isArray(warmResult?.bars) && warmResult.bars.length > 0) {
                    setBars(warmResult.bars);
                    setSource(warmResult.source ?? 'cache-warm');
                    setIsStale(Boolean(warmResult.isStale));
                }

                const needsCold = !warmResult?.bars?.length || warmResult.bars.length < 20;
                if (needsCold) {
                    const coldResult = await getHistoricalBarsCached(trade.symbol, {
                        startDate,
                        endDate: resolvedEnd,
                        tier: 'cold',
                        allowStale: true
                    });
                    if (cancelled) return;
                    if (Array.isArray(coldResult?.bars) && coldResult.bars.length > 0) {
                        setBars(coldResult.bars);
                        setSource(coldResult.source ?? 'cache-cold');
                        setIsStale(Boolean(coldResult.isStale));
                    }
                }
            } catch (fetchError) {
                if (!cancelled) {
                    setError('Replay data unavailable.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [visible, trade?.symbol, trade?.date]);

    const chartData = useMemo(() => (
        Array.isArray(bars)
            ? bars.map((bar) => ({
                date: bar.date,
                close: Number(bar.close),
                volume: Number(bar.volume || 0)
            })).filter((bar) => Boolean(bar.date) && Number.isFinite(bar.close))
            : []
    ), [bars]);

    const events = useMemo(() => (
        trade?.date
            ? [{ date: trade.date, label: 'Entry', impact: 'high' }]
            : []
    ), [trade?.date]);

    const dataTier = resolveTier(source, isStale);
    const dataTierLabel = resolveTierLabel(source, isStale);
    
    const raw = trade?.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, any> : undefined;

    const isOption = trade ? isOptionTrade(trade) : false;
    const showPurchasePrice = trade?.type === 'BUY' && !isOption;
    const multiplier = isOption ? (Number(trade?.multiplier) || 100) : 1;
    const qty = Number(trade?.quantity);
    const rawPrice = Number(trade?.price);
    const fallbackPrice = Number(raw?.avgPrice ?? raw?.price);
    const rawTotal = Number(trade?.total);
    const basePrice = (Number.isFinite(rawPrice) && rawPrice !== 0)
        ? rawPrice
        : (Number.isFinite(fallbackPrice) ? fallbackPrice : rawPrice);
    const computedTotal = Number.isFinite(basePrice) ? basePrice * qty * multiplier : NaN;
    const resolvedTotal = Number.isFinite(computedTotal) && computedTotal !== 0
        ? computedTotal
        : (Number.isFinite(rawTotal) ? rawTotal : computedTotal);
    const resolvedPrice = (Number.isFinite(basePrice) && basePrice !== 0)
        ? basePrice
        : (Number.isFinite(resolvedTotal) && qty !== 0 ? resolvedTotal / (qty * multiplier) : basePrice);
    const purchasePrice = showPurchasePrice ? resolvedPrice : undefined;
    
    const right = String(trade?.right || raw?.right || '').toUpperCase();
    const isCoveredCall = trade?.type === 'CC' || right === 'C';
    const isCashSecuredPut = trade?.type === 'CSP' || right === 'P';
    const accentColor = getStrategyColor(isCoveredCall ? 'CC' : isCashSecuredPut ? 'CSP' : 'BUY');
    const actionLabel = trade ? resolveActionLabel(trade) : '';

    const entryMetrics = useMemo(() => {
        if (!trade) return [];
        const formatValue = (value: number | undefined, decimals = 2, suffix = '') => (
            typeof value === 'number' && Number.isFinite(value)
                ? `${value.toFixed(decimals)}${suffix}`
                : '—'
        );
        const formatPercent = (value: number | undefined, decimals = 0) => (
            typeof value === 'number' && Number.isFinite(value)
                ? `${value.toFixed(decimals)}%`
                : '—'
        );
        return [
            { label: 'IV Rank', value: formatPercent(trade.entryIvRank, 0) },
            { label: 'VIX', value: formatValue(trade.entryVix, 1) },
            { label: 'Delta', value: formatValue(trade.entryDelta, 2) },
            { label: 'Theta', value: formatValue(trade.entryTheta, 2) },
            { label: 'RSI', value: formatValue(trade.entryRsi, 0) },
            { label: 'Beta', value: formatValue(trade.entryBeta, 2) }
        ];
    }, [trade]);

    if (!trade) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
                                {isOption ? (
                                    <PayoffGlyph type={isCoveredCall ? 'cc' : 'csp'} size={16} color="white" />
                                ) : (
                                    <Ionicons name="swap-vertical" size={16} color="white" />
                                )}
                            </View>
                            <View>
                                <Text style={styles.title}>{trade.symbol} Replay</Text>
                                <Text style={styles.subtitle}>{trade.date} • {actionLabel}</Text>
                            </View>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        <GlassCard style={styles.summaryCard} contentStyle={styles.summaryContent} blurIntensity={Theme.blur.medium}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Qty</Text>
                                <Text style={styles.summaryValue}>{trade.quantity}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Price</Text>
                                    <Text style={styles.summaryValue}>{formatCurrency(resolvedPrice)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Total</Text>
                                <Text style={styles.summaryValue}>
                                    {formatCompactCurrency(
                                        isOption 
                                            ? resolvedPrice * qty * multiplier
                                            : resolvedTotal,
                                        0
                                    )}
                                </Text>
                            </View>
                        </GlassCard>

                        {chartData.length > 0 ? (
                            <HistoricalChart
                                data={chartData}
                                symbol={trade.symbol}
                                height={240}
                                rangeLabel="Replay"
                                purchasePrice={showPurchasePrice ? purchasePrice : undefined}
                                events={events}
                                dataTier={dataTier ?? undefined}
                                dataTierLabel={dataTierLabel}
                                showVolumeProfile
                            />
                        ) : (
                            <GlassCard style={styles.chartPlaceholder} contentStyle={styles.chartPlaceholderContent} blurIntensity={Theme.blur.subtle}>
                                <Ionicons name={loading ? 'sync' : 'alert-circle-outline'} size={32} color={Theme.colors.textMuted} />
                                <Text style={styles.chartPlaceholderText}>
                                    {loading ? 'Loading replay data...' : error || 'No replay data available.'}
                                </Text>
                            </GlassCard>
                        )}

                        <GlassCard style={styles.metricsCard} contentStyle={styles.metricsContent} blurIntensity={Theme.blur.medium}>
                            <View style={styles.metricsHeader}>
                                <Text style={styles.metricsTitle}>Entry Snapshot</Text>
                                {dataTier && <DataTierBadge tier={dataTier} label={dataTierLabel} />}
                            </View>
                            <View style={styles.metricsGrid}>
                                {entryMetrics.map((metric) => (
                                    <View key={metric.label} style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>{metric.label}</Text>
                                        <Text style={[styles.metricValue, Theme.typography.numeric]}>{metric.value}</Text>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.metricsFootnote}>Captured at execution time.</Text>
                        </GlassCard>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: Theme.colors.modalScrim,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
    },
    sheet: {
        backgroundColor: Theme.colors.background,
        borderTopLeftRadius: Theme.borderRadius.xxl,
        borderTopRightRadius: Theme.borderRadius.xxl,
        maxHeight: '85%',
        paddingBottom: Theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Theme.spacing.lg,
        paddingTop: Theme.spacing.lg,
        paddingBottom: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
    },
    subtitle: {
        fontSize: Theme.typography.sizes.sm,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    closeButton: {
        padding: Theme.spacing.xs,
    },
    content: {
        padding: Theme.spacing.lg,
        gap: Theme.spacing.lg,
        paddingBottom: Theme.spacing.xxl,
    },
    summaryCard: {
        borderRadius: Theme.borderRadius.xl,
    },
    summaryContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: Theme.spacing.lg,
    },
    summaryRow: {
        alignItems: 'flex-start',
    },
    summaryLabel: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    summaryValue: {
        fontSize: Theme.typography.sizes.md,
        color: Theme.colors.text,
        fontWeight: Theme.typography.weights.semibold,
        marginTop: Theme.spacing.xs,
    },
    chartPlaceholder: {
        borderRadius: Theme.borderRadius.xl,
    },
    chartPlaceholderContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xl,
    },
    chartPlaceholderText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    metricsCard: {
        borderRadius: Theme.borderRadius.xl,
    },
    metricsContent: {
        padding: Theme.spacing.lg,
    },
    metricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    metricsTitle: {
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.bold,
        fontSize: Theme.typography.sizes.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Theme.spacing.md,
    },
    metricItem: {
        width: '30%',
        minWidth: 80,
    },
    metricLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    metricValue: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
        marginTop: Theme.spacing.xs,
    },
    metricsFootnote: {
        marginTop: Theme.spacing.md,
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    }
});
