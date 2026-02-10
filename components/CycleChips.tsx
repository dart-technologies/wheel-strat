import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { formatCompactCurrency, formatCompactPercent } from '@/utils/format';
import type { IbkrTradingMode } from '@wheel-strat/shared';

type CycleChipsProps = {
    // Row 1: Acquire | Hold | Harvest
    cspCount: number;
    cspValue: number;
    cspDailyPct: number | null;
    
    stockShares: number;
    stockValue: number;
    stockDailyPct: number | null;
    
    ccCount: number;
    ccValue: number;
    ccDailyPct: number | null;
    
    // Row 2: Accumulate (Liquidity)
    netLiquidity: number;
    netLiqDailyPct: number | null;
    realizedMtd: number | null;
    realizedYtd: number | null;
    availableFunds: number;
    bpUsagePct: number | null;
    
    // Data source indicator
    isSeedData: boolean;
    tradingMode?: IbkrTradingMode;
};

export default function CycleChips({
    cspCount,
    cspValue,
    cspDailyPct,
    stockShares,
    stockValue,
    stockDailyPct,
    ccCount,
    ccValue,
    ccDailyPct,
    netLiquidity,
    netLiqDailyPct,
    realizedMtd,
    realizedYtd,
    availableFunds,
    bpUsagePct,
    isSeedData,
    tradingMode
}: CycleChipsProps) {
    const getTone = (val: number | null): 'neutral' | 'positive' | 'negative' => {
        if (val === null) return 'neutral';
        return val >= 0 ? 'positive' : 'negative';
    };

    const showPaper = tradingMode === 'paper';
    const showLive = tradingMode === 'live';
    const dataLabel = isSeedData ? 'SEED' : showPaper ? 'PAPER' : showLive ? 'LIVE' : 'DATA';

    const formatCount = (value: number, label: string) => {
        const rounded = Number.isFinite(value) ? Math.round(value) : 0;
        if (rounded <= 0) return label;
        const suffix = rounded === 1 ? label : `${label}s`;
        return `${rounded} ${suffix}`;
    };

    const formatShares = (value: number) => {
        const rounded = Number.isFinite(value) ? Math.round(value) : 0;
        return `${rounded.toLocaleString()} sh`;
    };

    return (
        <View style={styles.container}>
            {/* Main Connected Card */}
            <View style={styles.mainCard}>
                {/* Header: Horizontally aligned title and pill */}
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.chipEyebrow}>Accumulate</Text>
                        {/* <Text style={styles.chipTitle}>Liquidity</Text> */}
                    </View>
                    <View style={styles.pillContainer}>
                        <View style={[
                            styles.dataSourcePill,
                            !isSeedData && showPaper ? styles.dataSourcePillPaper : null,
                            !isSeedData && showLive ? styles.dataSourcePillLive : null
                        ]}>
                            <Text style={[
                                styles.dataSourceText,
                                !isSeedData && showPaper ? styles.dataSourceTextPaper : null,
                                !isSeedData && showLive ? styles.dataSourceTextLive : null
                            ]}>
                                {dataLabel}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Liquidity Section */}
                <View style={styles.liquiditySection}>
                    {/* Row 1: Net Liquidity | Available Funds (Balanced spacing) */}
                    <View style={[styles.liquidityRow, styles.topLiquidityRow]}>
                        <View style={styles.liquidityItem}>
                            <Text style={styles.liquidityLabel}>Net Liquidity</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.liquidityValue}>{formatCompactCurrency(netLiquidity, 0)}</Text>
                                {/* <Text style={[
                                    styles.liquidityChange,
                                    getTone(netLiqDailyPct) === 'positive' && styles.textSuccess,
                                    getTone(netLiqDailyPct) === 'negative' && styles.textDanger
                                ]}>
                                    {netLiqDailyPct !== null ? formatCompactPercent(netLiqDailyPct, 1) : ''}
                                </Text> */}
                            </View>
                        </View>
                        <View style={styles.liquidityItem}>
                            <Text style={styles.liquidityLabel}>Available Funds</Text>
                            <Text style={styles.liquidityValue}>{formatCompactCurrency(availableFunds, 0)}</Text>
                        </View>
                    </View>

                    {/* Row 2: Realized MTD | Realized YTD */}
                    <View style={[styles.liquidityRow, styles.realizedRow]}>
                        <View style={styles.liquidityItem}>
                            <Text style={styles.liquidityLabel}>Realized (MTD)</Text>
                            <Text style={[
                                styles.liquidityValue,
                                getTone(realizedMtd) === 'positive' && styles.textSuccess,
                                getTone(realizedMtd) === 'negative' && styles.textDanger
                            ]}>
                                {realizedMtd !== null ? formatCompactPercent(realizedMtd, 1) : '—'}
                            </Text>
                        </View>
                        <View style={styles.liquidityItem}>
                            <Text style={styles.liquidityLabel}>Realized (YTD)</Text>
                            <Text style={[
                                styles.liquidityValue,
                                getTone(realizedYtd) === 'positive' && styles.textSuccess,
                                getTone(realizedYtd) === 'negative' && styles.textDanger
                            ]}>
                                {realizedYtd !== null ? formatCompactPercent(realizedYtd, 1) : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Cycle Section: Connected below */}
                <View style={styles.cycleRow}>
                    {/* Acquire (CSP) */}
                    <View style={[styles.cycleChip, styles.chipAcquire, styles.chipLeft]}>
                        <Text style={styles.chipTitleSmall}>{formatCount(cspCount, 'CSP')}</Text>
                        <View style={styles.cycleMetrics}>
                            <Text style={styles.metricValue}>{formatCompactCurrency(cspValue, 0)}</Text>
                            <Text style={[
                                styles.metricChange,
                                getTone(cspDailyPct) === 'positive' && styles.textSuccess,
                                getTone(cspDailyPct) === 'negative' && styles.textDanger
                            ]}>
                                {cspDailyPct !== null ? formatCompactPercent(cspDailyPct, 1) : '—'}
                            </Text>
                        </View>
                        <Text style={styles.chipEyebrowBottom}>Acquire</Text>
                    </View>

                    {/* Hold (Equity) */}
                    <View style={[styles.cycleChip, styles.chipHold, styles.chipMiddle]}>
                        <Text style={styles.chipTitleSmall}>{formatShares(stockShares)}</Text>
                        <View style={styles.cycleMetrics}>
                            <Text style={styles.metricValue}>{formatCompactCurrency(stockValue, 0)}</Text>
                            <Text style={[
                                styles.metricChange,
                                getTone(stockDailyPct) === 'positive' && styles.textSuccess,
                                getTone(stockDailyPct) === 'negative' && styles.textDanger
                            ]}>
                                {stockDailyPct !== null ? formatCompactPercent(stockDailyPct, 1) : '—'}
                            </Text>
                        </View>
                        <Text style={styles.chipEyebrowBottom}>Hold</Text>
                    </View>

                    {/* Harvest (CC) */}
                    <View style={[styles.cycleChip, styles.chipHarvest, styles.chipRight]}>
                        <Text style={styles.chipTitleSmall}>{formatCount(ccCount, 'CC')}</Text>
                        <View style={styles.cycleMetrics}>
                            <Text style={styles.metricValue}>{formatCompactCurrency(ccValue, 0)}</Text>
                            <Text style={[
                                styles.metricChange,
                                getTone(ccDailyPct) === 'positive' && styles.textSuccess,
                                getTone(ccDailyPct) === 'negative' && styles.textDanger
                            ]}>
                                {ccDailyPct !== null ? formatCompactPercent(ccDailyPct, 1) : '—'}
                            </Text>
                        </View>
                        <Text style={styles.chipEyebrowBottom}>Harvest</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
    },
    mainCard: {
        width: '100%',
        backgroundColor: Theme.colors.glassSubtle,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.dividerLine,
    },
    titleContainer: {
        flex: 1,
    },
    pillContainer: {
        marginLeft: Theme.spacing.sm,
    },
    liquiditySection: {
        padding: Theme.spacing.md,
        gap: Theme.spacing.sm,
    },
    liquidityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topLiquidityRow: {
        justifyContent: 'space-around',
    },
    realizedRow: {
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: Theme.colors.dividerLine,
        paddingTop: Theme.spacing.sm,
    },
    liquidityItem: {
        alignItems: 'center',
    },
    liquidityLabel: {
        fontSize: 10,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    liquidityValue: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
        fontVariant: ['tabular-nums'],
    },
    liquidityChange: {
        fontSize: 10,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    cycleRow: {
        flexDirection: 'row',
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: Theme.colors.glassBorder,
    },
    cycleChip: {
        flex: 1,
        padding: Theme.spacing.sm,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 72,
    },
    chipLeft: {
        borderRightWidth: 1,
        borderRightColor: Theme.colors.glassBorder,
    },
    chipMiddle: {
        borderRightWidth: 1,
        borderRightColor: Theme.colors.glassBorder,
    },
    chipRight: {
    },
    chipAcquire: {
        backgroundColor: Theme.colors.strategyCspWash,
    },
    chipHold: {
        backgroundColor: Theme.colors.glassSubtle,
    },
    chipHarvest: {
        backgroundColor: Theme.colors.strategyCcWash,
    },
    chipEyebrow: {
        fontSize: 9,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600',
    },
    chipTitle: {
        fontSize: 12,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
    },
    chipTitleSmall: {
        fontSize: 11,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
        marginBottom: 2,
    },
    chipEyebrowBottom: {
        fontSize: 9,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600',
        marginTop: 4,
    },
    cycleMetrics: {
        alignItems: 'center',
        gap: 2,
    },
    metricValue: {
        fontSize: 13,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
        fontVariant: ['tabular-nums'],
    },
    metricChange: {
        fontSize: 10,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    dataSourcePill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    dataSourcePillPaper: {
        backgroundColor: Theme.colors.tradingPaperWash,
        borderColor: Theme.colors.tradingPaper,
    },
    dataSourcePillLive: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    dataSourceText: {
        fontSize: 8,
        fontWeight: '800',
        color: Theme.colors.textMuted,
        letterSpacing: 1,
    },
    dataSourceTextPaper: {
        color: Theme.colors.tradingPaper,
    },
    dataSourceTextLive: {
        color: Theme.colors.success,
    },
    textSuccess: {
        color: Theme.colors.profit,
    },
    textDanger: {
        color: Theme.colors.loss,
    },
});
