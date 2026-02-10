import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import GlassCard from '@/components/GlassCard';
import CycleChips from '@/components/CycleChips';
import { Skeleton } from '@/components/Skeleton';
import { formatCompactCurrency, formatCompactPercent } from '@/utils/format';
import { getIbkrTradingMode, type IbkrTradingMode, OptionPosition, Position } from '@wheel-strat/shared';
import { PositionGroup, PositionSortMode } from '@/features/portfolio/hooks';
import { DashboardPositionsTable } from './DashboardPositionsTable';
import { styles } from './styles';

type DashboardSummarySectionProps = {
    isIPad: boolean;
    positions: Record<string, Position>;
    optionPositions: Record<string, OptionPosition>;
    netLiqDisplay: number;
    dayChangePct: number | null;
    monthYield: number | null;
    yearYield: number | null;
    availableFundsDisplay: number;
    bpUsagePct: number | null;
    isSeedData: boolean;
    dayChangeValue: number | null;
    totalReturn: number | null;
    totalReturnPct: number | null;
    pnlStatus?: 'ready' | 'stale' | 'loading';
    positionsStatus?: 'ready' | 'stale' | 'loading';
    groupedPositions: PositionGroup[];
    sortMode: PositionSortMode;
    onSort: (key: string) => void;
};

const toNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const calcDailyPct = (current?: number | null, close?: number | null) => {
    if (typeof current !== 'number' || !Number.isFinite(current)) return null;
    if (typeof close !== 'number' || !Number.isFinite(close) || close === 0) return null;
    return ((current - close) / close) * 100;
};

export function DashboardSummarySection({
    isIPad,
    positions,
    optionPositions,
    netLiqDisplay,
    dayChangePct,
    monthYield,
    yearYield,
    availableFundsDisplay,
    bpUsagePct,
    isSeedData,
    dayChangeValue,
    totalReturn,
    totalReturnPct,
    pnlStatus,
    positionsStatus,
    groupedPositions,
    sortMode,
    onSort
}: DashboardSummarySectionProps) {
    const metricColumns = 2;
    const metricCellStyle = useMemo(() => {
        const width = metricColumns === 2 ? '46%' : `${100 / metricColumns}%`;
        return { width: width as `${number}%` };
    }, [metricColumns]);
    const tradingMode: IbkrTradingMode = useMemo(() => getIbkrTradingMode(), []);
    const resolvedPnlStatus = pnlStatus ?? 'ready';
    const isPnlLoading = resolvedPnlStatus === 'loading';
    const isPnlStale = resolvedPnlStatus === 'stale';

    const cycleChips = useMemo(() => {
        let cspCount = 0;
        let cspTotalValue = 0;
        let cspTotalCurrent = 0;
        let cspTotalClose = 0;

        let stockShares = 0;
        let stockTotalValue = 0;
        let stockTotalCurrent = 0;
        let stockTotalClose = 0;

        let ccCount = 0;
        let ccTotalValue = 0;
        let ccTotalCurrent = 0;
        let ccTotalClose = 0;

        const optionList = Object.values(optionPositions || {});
        const stockList = Object.values(positions || {});

        optionList.forEach((option) => {
            const qty = toNumber(option.quantity) ?? 0;
            if (!qty) return;
            const right = (option.right || '').toUpperCase();
            if (right !== 'P' && right !== 'C') return;
            const isShort = qty < 0;
            if (!isShort) return;

            const multiplier = toNumber(option.multiplier) ?? 100;
            const currentPrice = toNumber(option.currentPrice) ?? 0;
            const closePrice = toNumber(option.closePrice);
            const resolvedClose = (typeof closePrice === 'number' && closePrice > 0)
                ? closePrice
                : currentPrice;

            const marketVal = Math.abs(qty) * currentPrice * multiplier;

            if (right === 'P') {
                cspCount += Math.abs(qty);
                cspTotalValue += marketVal;
                cspTotalCurrent += currentPrice * Math.abs(qty);
                cspTotalClose += resolvedClose * Math.abs(qty);
            } else if (right === 'C') {
                ccCount += Math.abs(qty);
                ccTotalValue += marketVal;
                ccTotalCurrent += currentPrice * Math.abs(qty);
                ccTotalClose += resolvedClose * Math.abs(qty);
            }
        });

        stockList.forEach((pos) => {
            const qty = toNumber(pos.quantity) ?? 0;
            const price = toNumber(pos.currentPrice) ?? 0;
            const close = toNumber(pos.closePrice);

            stockShares += qty;
            stockTotalValue += qty * price;

            if (close !== null && close > 0) {
                stockTotalCurrent += price * Math.abs(qty);
                stockTotalClose += close * Math.abs(qty);
            }
        });

        const cspDailyPct = cspTotalClose > 0 ? calcDailyPct(cspTotalCurrent, cspTotalClose) : null;
        const stockDailyPct = stockTotalClose > 0 ? calcDailyPct(stockTotalCurrent, stockTotalClose) : null;
        const ccDailyPct = ccTotalClose > 0 ? calcDailyPct(ccTotalCurrent, ccTotalClose) : null;

        return {
            cspCount,
            cspTotalValue,
            cspDailyPct,
            stockShares,
            stockTotalValue,
            stockDailyPct,
            ccCount,
            ccTotalValue,
            ccDailyPct
        };
    }, [optionPositions, positions]);

    return (
        <View style={isIPad ? styles.ipadHeader : null}>
            <CycleChips
                cspCount={cycleChips.cspCount}
                cspValue={cycleChips.cspTotalValue}
                cspDailyPct={cycleChips.cspDailyPct}
                stockShares={cycleChips.stockShares}
                stockValue={cycleChips.stockTotalValue}
                stockDailyPct={cycleChips.stockDailyPct}
                ccCount={cycleChips.ccCount}
                ccValue={cycleChips.ccTotalValue}
                ccDailyPct={cycleChips.ccDailyPct}
                netLiquidity={netLiqDisplay}
                netLiqDailyPct={dayChangePct}
                realizedMtd={monthYield}
                realizedYtd={yearYield}
                availableFunds={availableFundsDisplay}
                bpUsagePct={bpUsagePct}
                isSeedData={isSeedData}
                tradingMode={tradingMode}
            />

            <View style={isIPad ? styles.ipadTopRow : null}>
                <GlassCard style={[styles.card, isIPad && styles.ipadSummaryCard]} contentStyle={styles.overviewContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.performanceHeader}>
                        <Text style={styles.performanceEyebrow}>Performance</Text>
                    </View>

                    <View style={styles.metricGrid}>
                        <View style={[styles.metricCell, metricCellStyle]}>
                            <Text style={styles.metricLabel}>Daily P&L</Text>
                            {isPnlLoading ? (
                                <View style={styles.metricSkeletonStack}>
                                    <Skeleton width={72} height={18} style={styles.metricSkeleton} />
                                    <Skeleton width={48} height={10} style={styles.metricSkeletonSub} />
                                </View>
                            ) : (
                                <>
                                    <Text style={[
                                        styles.metricValue,
                                        dayChangeValue !== null ? (dayChangeValue >= 0 ? styles.textSuccess : styles.textDanger) : styles.textMuted
                                    ]}>
                                        {dayChangeValue !== null ? formatCompactCurrency(dayChangeValue, 2) : '—'}
                                    </Text>
                                    <Text style={styles.metricSubLabel}>
                                        {dayChangePct !== null
                                            ? formatCompactPercent(dayChangePct, 1)
                                            : (isPnlStale ? 'Updating...' : 'Session change')}
                                    </Text>
                                </>
                            )}
                        </View>

                        <View style={[styles.metricCell, metricCellStyle]}>
                            <Text style={styles.metricLabel}>Unrealized P&L</Text>
                            {isPnlLoading ? (
                                <View style={styles.metricSkeletonStack}>
                                    <Skeleton width={72} height={18} style={styles.metricSkeleton} />
                                    <Skeleton width={48} height={10} style={styles.metricSkeletonSub} />
                                </View>
                            ) : (
                                <>
                                    <Text style={[
                                        styles.metricValue,
                                        totalReturn !== null ? (totalReturn >= 0 ? styles.textSuccess : styles.textDanger) : styles.textMuted
                                    ]}>
                                        {totalReturn !== null ? formatCompactCurrency(totalReturn, 2) : '—'}
                                    </Text>
                                    <Text style={styles.metricSubLabel}>
                                        {totalReturnPct !== null
                                            ? formatCompactPercent(totalReturnPct, 1)
                                            : (isPnlStale ? 'Updating...' : '—')}
                                    </Text>
                                </>
                            )}
                        </View>

                    </View>
                </GlassCard>
            </View>

            <DashboardPositionsTable
                groupedPositions={groupedPositions}
                sortMode={sortMode}
                isIPad={isIPad}
                status={positionsStatus}
                onSort={onSort}
            />
        </View>
    );
}
