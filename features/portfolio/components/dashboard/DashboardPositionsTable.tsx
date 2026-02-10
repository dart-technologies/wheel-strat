import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Theme } from '@/constants/theme';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import Sparkline from '@/components/Sparkline';
import { Skeleton } from '@/components/Skeleton';
import { formatCompactCurrency, formatCompactPercent } from '@/utils/format';
import { PositionGroup, PositionSortMode } from '@/features/portfolio/hooks';
import { styles } from './styles';

const getSparklineData = (_symbol: string): number[] | null => {
    // Disabled: using 1-year historical data is misleading for daily changes.
    return null;
};

type DashboardPositionsTableProps = {
    groupedPositions: PositionGroup[];
    sortMode: PositionSortMode;
    isIPad: boolean;
    onSort: (key: string) => void;
    status?: 'ready' | 'stale' | 'loading';
};

export function DashboardPositionsTable({
    groupedPositions,
    sortMode,
    isIPad,
    onSort,
    status
}: DashboardPositionsTableProps) {
    const router = useRouter();
    const isLoading = status === 'loading';

    const positionTableColumns = useMemo<DataTableColumn[]>(() => {
        if (isIPad) {
            return [
                { key: 'symbol', label: 'Symbol', flex: 1.2, sortable: true },
                { key: 'last', label: 'Last / Chg', align: 'right', flex: 1, sortable: false },
                { key: 'marketValue', label: 'Mkt Value', align: 'right', flex: 1, sortable: true },
                { key: 'cspYield', label: 'CSP', align: 'right', flex: 0.8, sortable: true },
                { key: 'ccYield', label: 'CC', align: 'right', flex: 0.8, sortable: true },
                { key: 'dailyPnL', label: 'Daily P&L', align: 'right', flex: 1, sortable: true },
                // { key: 'greeks', label: 'Greeks', align: 'right', flex: 1.2, sortable: false },
            ];
        }
        return [
            { key: 'symbol', label: 'Symbol', flex: 1.2, sortable: true },
            { key: 'last', label: 'Last', align: 'right', flex: 1, sortable: false },
            { key: 'marketValue', label: 'Mkt Val', align: 'right', flex: 1, sortable: true },
            { key: 'cspYield', label: 'CSP', align: 'right', flex: 0.8, sortable: true },
            { key: 'ccYield', label: 'CC', align: 'right', flex: 0.8, sortable: true },
        ];
    }, [isIPad]);

    const positionTableRows = useMemo(() => {
        return groupedPositions.map((group) => {
            const stock = group.stock;
            const quantity = stock ? Number(stock.quantity) || 0 : 0;
            const averageCost = stock ? Number(stock.averageCost) || 0 : 0;
            const currentPrice = stock ? (Number(stock.currentPrice) || averageCost) : 0;
            const closePrice = stock ? Number(stock.closePrice) : NaN;
            const resolvedStockClose = Number.isFinite(closePrice) && closePrice > 0 ? closePrice : null;

            // Stock Metrics
            const stockDailyPnl = resolvedStockClose !== null ? (currentPrice - resolvedStockClose) * quantity : 0;
            const stockMarketValue = currentPrice * quantity;

            // Stock daily % (for display in Last column)
            const stockDailyPct = resolvedStockClose !== null
                ? ((currentPrice - resolvedStockClose) / resolvedStockClose) * 100
                : null;

            // Option Metrics
            let ccCount = 0;
            let cspCount = 0;
            let optionMarketValue = 0;
            let optionDailyPnl = 0;
            let prevOptionValue = 0;
            let hasPrevValue = resolvedStockClose !== null && quantity !== 0;

            group.options.forEach((opt) => {
                const qty = Number(opt.quantity) || 0;
                const price = Number(opt.currentPrice) || Number(opt.averageCost) || 0;
                const close = Number(opt.closePrice);
                const resolvedClose = Number.isFinite(close) && close > 0 ? close : null;
                const mult = Number(opt.multiplier) || 100;
                const right = (opt.right || '').toUpperCase();

                if (qty < 0) {
                    if (right === 'C') ccCount += Math.abs(qty);
                    else if (right === 'P') cspCount += Math.abs(qty);
                }

                optionMarketValue += price * qty * mult;
                optionDailyPnl += (price - (resolvedClose ?? price)) * qty * mult;

                if (resolvedClose !== null && qty !== 0) {
                    prevOptionValue += resolvedClose * qty * mult;
                    hasPrevValue = true;
                }
            });

            const totalDailyPnl = (stockDailyPnl || 0) + optionDailyPnl;
            const totalMarketValue = stockMarketValue + optionMarketValue;
            const prevMarketValue = (resolvedStockClose !== null ? resolvedStockClose * quantity : 0) + prevOptionValue;

            const displayDailyPct = stock ? stockDailyPct : null;
            const dailyTone = displayDailyPct !== null
                ? (displayDailyPct >= 0 ? styles.textSuccess : styles.textDanger)
                : styles.textMuted;

            const sparklineData = getSparklineData(group.symbol);
            const sparklineTrendUp = sparklineData && sparklineData.length > 1
                ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
                : true;

            const cspCountText = `${cspCount} CSP`;
            const ccCountText = `${ccCount} CC`;

            const marketValueDailyPct = hasPrevValue && prevMarketValue !== 0
                ? (totalDailyPnl / Math.abs(prevMarketValue)) * 100
                : null;
            const marketDailyTone = marketValueDailyPct !== null
                ? (marketValueDailyPct >= 0 ? styles.textSuccess : styles.textDanger)
                : styles.textMuted;

            const symbolCell = (
                <View>
                    <View style={styles.symbolRow}>
                        <Text style={styles.tableSymbol}>{group.symbol}</Text>
                        {stock && (
                            <Text style={styles.tableSecondary}>
                                {quantity === 0 ? '0 sh' : `${quantity} sh`}
                            </Text>
                        )}
                    </View>
                    {sparklineData && (
                        <View style={styles.sparklineRow}>
                            <Sparkline
                                data={sparklineData}
                                width={isIPad ? 120 : 90}
                                height={20}
                                stroke={sparklineTrendUp ? Theme.colors.success : Theme.colors.error}
                            />
                        </View>
                    )}
                </View>
            );

            const lastCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                        {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
                    </Text>
                    <Text style={[styles.tableSecondary, dailyTone]}>
                        {displayDailyPct !== null ? formatCompactPercent(displayDailyPct, 1) : '—'}
                    </Text>
                </View>
            );

            const marketCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                        {formatCompactCurrency(totalMarketValue, 0)}
                    </Text>
                    <Text style={[styles.tableSecondary, marketDailyTone]}>
                        {marketValueDailyPct !== null ? formatCompactPercent(marketValueDailyPct, 1) : '—'}
                    </Text>
                </View>
            );

            const ccYieldCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                        {group.ccYield !== null && group.ccYield !== undefined ? formatCompactPercent(group.ccYield, 0) : '—'}
                    </Text>
                    <Text style={styles.tableSecondary}>
                        {ccCountText}
                    </Text>
                </View>
            );

            const cspYieldCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>
                        {group.cspYield !== null && group.cspYield !== undefined ? formatCompactPercent(group.cspYield, 0) : '—'}
                    </Text>
                    <Text style={styles.tableSecondary}>
                        {cspCountText}
                    </Text>
                </View>
            );

            const dailyCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric, dailyTone]}>
                        {formatCompactCurrency(totalDailyPnl, 0)}
                    </Text>
                </View>
            );

            const delta = Number(stock?.delta ?? stock?.ccDelta ?? stock?.cspDelta);
            const theta = Number(stock?.theta ?? stock?.ccTheta ?? stock?.cspTheta);
            const ivRank = Number(stock?.ivRank);

            const hasGreeks = Number.isFinite(delta) || Number.isFinite(theta) || Number.isFinite(ivRank);
            const greekText = hasGreeks
                ? `Δ ${Number.isFinite(delta) ? delta.toFixed(2) : '--'} • θ ${Number.isFinite(theta) ? theta.toFixed(2) : '--'} • IV ${Number.isFinite(ivRank) ? ivRank.toFixed(0) : '--'}`
                : '—';

            const greeksCell = (
                <Text style={[styles.tableSecondary, styles.tableCellRightText]}>
                    {greekText}
                </Text>
            );

            const cells = isIPad
                ? {
                    symbol: symbolCell,
                    last: lastCell,
                    dailyPnL: dailyCell,
                    marketValue: marketCell,
                    cspYield: cspYieldCell,
                    ccYield: ccYieldCell,
                    greeks: greeksCell
                }
                : {
                    symbol: symbolCell,
                    last: lastCell,
                    marketValue: marketCell,
                    cspYield: cspYieldCell,
                    ccYield: ccYieldCell
                };

            return {
                key: group.symbol,
                cells,
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/position/${group.symbol}`);
                }
            };
        });
    }, [groupedPositions, isIPad, router, styles]);

    const skeletonRows = useMemo(() => {
        const count = isIPad ? 4 : 3;
        const rows = Array.from({ length: count }).map((_, index) => {
            const symbolCell = (
                <View>
                    <Skeleton width={56} height={14} style={styles.skeletonCell} />
                    <Skeleton width={40} height={10} style={styles.skeletonCellSub} />
                </View>
            );
            const lastCell = (
                <View style={styles.tableCellRight}>
                    <Skeleton width={44} height={12} style={styles.skeletonCell} />
                    <Skeleton width={32} height={10} style={styles.skeletonCellSub} />
                </View>
            );
            const marketCell = (
                <View style={styles.tableCellRight}>
                    <Skeleton width={52} height={12} style={styles.skeletonCell} />
                    <Skeleton width={36} height={10} style={styles.skeletonCellSub} />
                </View>
            );
            const yieldCell = (
                <View style={styles.tableCellRight}>
                    <Skeleton width={30} height={12} style={styles.skeletonCell} />
                    <Skeleton width={28} height={10} style={styles.skeletonCellSub} />
                </View>
            );
            const dailyCell = (
                <View style={styles.tableCellRight}>
                    <Skeleton width={48} height={12} style={styles.skeletonCell} />
                </View>
            );

            const cells = isIPad
                ? {
                    symbol: symbolCell,
                    last: lastCell,
                    dailyPnL: dailyCell,
                    marketValue: marketCell,
                    cspYield: yieldCell,
                    ccYield: yieldCell,
                }
                : {
                    symbol: symbolCell,
                    last: lastCell,
                    marketValue: marketCell,
                    cspYield: yieldCell,
                    ccYield: yieldCell,
                };
            return {
                key: `skeleton-${index}`,
                cells
            };
        });
        return rows;
    }, [isIPad]);

    return (
        <View style={[styles.section, isIPad && styles.sectionWide]}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} testID="positions-header">Positions</Text>
            </View>
            <View style={styles.tableWrapper}>
                <DataTable
                    columns={positionTableColumns}
                    rows={isLoading ? skeletonRows : positionTableRows}
                    onHeaderPress={onSort}
                    sortColumn={sortMode}
                    sortDirection={sortMode === 'symbol' ? 'asc' : 'desc'}
                />
            </View>
        </View>
    );
}
