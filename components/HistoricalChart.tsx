import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CartesianChart, Area, Line, useChartPressState } from 'victory-native';
import { LinearGradient, Rect, vec, Line as SkiaLine, Circle } from "@shopify/react-native-skia";
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Theme } from '../constants/theme';
import GlassCard from './GlassCard';
import DataTierBadge, { type DataTier } from './DataTierBadge';

const withAlpha = (color: string, alphaHex: string) => {
    if (color.startsWith('#') && (color.length === 7 || color.length === 9)) {
        return `${color.slice(0, 7)}${alphaHex}`;
    }
    return color;
};

interface HistoricalBar {
    date: string;
    close: number;
    volume?: number;
}

interface HistoricalChartProps {
    data: HistoricalBar[];
    symbol: string;
    height?: number;
    support?: number;
    resistance?: number;
    purchasePrice?: number;
    spotPrice?: number;
    strikePrice?: number;
    rangeLabel?: string;
    showHeader?: boolean;
    dataTier?: DataTier;
    dataTierLabel?: string;
    impliedVol?: number;
    coneHorizonDays?: number;
    showVolumeProfile?: boolean;
    events?: { date: string; label?: string; impact?: 'high' | 'medium' | 'low' | string }[];
    accentColor?: string;
    useContainer?: boolean;
    compact?: boolean;
}

export default function HistoricalChart({
    data,
    symbol,
    height = 220,
    support,
    resistance,
    purchasePrice,
    spotPrice,
    strikePrice,
    rangeLabel,
    showHeader = true,
    dataTier,
    dataTierLabel,
    impliedVol,
    coneHorizonDays = 30,
    showVolumeProfile = false,
    events = [],
    accentColor,
    useContainer = true,
    compact = false,
}: HistoricalChartProps) {
    const { state: pressState } = useChartPressState({ x: 0, y: { close: 0 } });
    const [pressPoint, setPressPoint] = useState<{
        x: number;
        y: number;
        xValue: number;
        yValue: number;
    } | null>(null);

    useAnimatedReaction(
        () => ({
            active: pressState.isActive.value,
            x: pressState.x.position.value,
            y: pressState.y.close.position.value,
            xValue: pressState.x.value.value,
            yValue: pressState.y.close.value.value,
        }),
        (value) => {
            if (!value.active) {
                runOnJS(setPressPoint)(null);
                return;
            }
            const xValue = Number(value.xValue);
            const yValue = Number(value.yValue);
            runOnJS(setPressPoint)({
                x: value.x,
                y: value.y,
                xValue: Number.isFinite(xValue) ? xValue : 0,
                yValue: Number.isFinite(yValue) ? yValue : 0,
            });
        }
    );

    const hasData = Array.isArray(data) && data.length > 0;
    const safeData = useMemo(() => (hasData ? data : []), [hasData, data]);

    // Format data for Victory V41 (Skia)
    const chartData = safeData.map((d, i) => ({
        day: i,
        close: d.close,
        volume: d.volume ?? 0,
    }));

    const activeIndex = pressPoint ? Math.round(pressPoint.xValue) : null;
    const activeBar = activeIndex !== null && safeData[activeIndex] ? safeData[activeIndex] : null;
    const recentClose = hasData ? safeData[safeData.length - 1].close : 0;
    const startClose = hasData ? safeData[0].close : 0;
    const isPositive = recentClose >= startClose;
    const chartColor = isPositive ? Theme.colors.success : Theme.colors.error;
    const title = rangeLabel ? `${symbol} ${rangeLabel} Performance` : `${symbol} 1Y Performance`;
    const displayClose = activeBar?.close ?? recentClose;
    const displayDate = activeBar?.date;
    const displayChangePct = startClose !== 0
        ? ((displayClose - startClose) / startClose) * 100
        : 0;
    const resolvedVol = typeof impliedVol === 'number'
        ? (impliedVol > 1 ? impliedVol / 100 : impliedVol)
        : null;
    const sigma = resolvedVol
        ? recentClose * resolvedVol * Math.sqrt(coneHorizonDays / 365)
        : null;
    const coneLevels = sigma
        ? [recentClose + sigma, recentClose - sigma, recentClose + (sigma * 2), recentClose - (sigma * 2)]
        : [];
    const yValues = safeData.map((bar) => bar.close).filter((value) => typeof value === 'number');
    const levelValues = [support, resistance, purchasePrice, spotPrice, strikePrice, ...coneLevels].filter(
        (value): value is number => typeof value === 'number'
    );
    const minValue = Math.min(...(yValues.length ? yValues : [0]), ...levelValues, 0);
    const maxValue = Math.max(...(yValues.length ? yValues : [0]), ...levelValues, 0);
    const range = Math.max(1, maxValue - minValue);
    const padding = range * 0.08;
    const yDomain: [number, number] = [minValue - padding, maxValue + padding];
    const eventMarkers = useMemo(() => {
        if (!events.length) return [];
        const map = new Map<string, number>();
        safeData.forEach((bar, index) => {
            if (bar?.date) map.set(bar.date, index);
        });
        return events.map((event) => {
            if (!event?.date) return null;
            const exactIndex = map.get(event.date);
            if (typeof exactIndex === 'number') {
                return { ...event, index: exactIndex };
            }
            const eventTime = new Date(event.date).getTime();
            if (Number.isNaN(eventTime)) return null;
            let closestIndex = -1;
            let closestDiff = Number.POSITIVE_INFINITY;
            safeData.forEach((bar, index) => {
                if (!bar?.date) return;
                const barTime = new Date(bar.date).getTime();
                if (Number.isNaN(barTime)) return;
                const diff = Math.abs(barTime - eventTime);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = index;
                }
            });
            return closestIndex >= 0 ? { ...event, index: closestIndex } : null;
        }).filter((event): event is { date: string; label?: string; impact?: string; index: number } => Boolean(event));
    }, [events, safeData]);
    const volumeBins = useMemo(() => {
        if (!showVolumeProfile) return [];
        const bins = Array.from({ length: 12 }, () => 0);
        const range = maxValue - minValue;
        if (!Number.isFinite(range) || range <= 0) return [];
        safeData.forEach((bar) => {
            const price = Number(bar.close);
            const volume = Number(bar.volume);
            if (!Number.isFinite(price) || !Number.isFinite(volume)) return;
            const index = Math.min(
                bins.length - 1,
                Math.max(0, Math.floor(((price - minValue) / range) * bins.length))
            );
            bins[index] += volume;
        });
        return bins;
    }, [showVolumeProfile, safeData, minValue, maxValue]);
    const maxVolume = volumeBins.length ? Math.max(...volumeBins) : 0;

    const contentStyles = [
        styles.content,
        compact ? styles.contentCompact : null
    ];

    if (!hasData) {
        if (!useContainer) {
            return (
                <View style={[styles.plainContainer, { height }]}>
                    <Text style={styles.errorText}>No historical data available</Text>
                </View>
            );
        }
        return (
            <GlassCard
                style={[styles.container, { height }]}
                contentStyle={contentStyles}
                useNativeGlass={false}
                useBlur={false}
            >
                <Text style={styles.errorText}>No historical data available</Text>
            </GlassCard>
        );
    }

    const renderContent = () => (
        <>
            {showHeader && (
                <View style={[styles.header, compact ? styles.headerCompact : null]}>
                    <Text style={styles.title}>{title}</Text>
                    <View style={styles.headerRight}>
                        <View style={styles.headerMetrics}>
                            <Text style={[styles.change, { color: chartColor }, Theme.typography.numeric]}>
                                {displayChangePct.toFixed(1)}%
                            </Text>
                            <Text style={[styles.currentPrice, Theme.typography.numeric]}>${(displayClose ?? 0).toFixed(2)}</Text>
                            {displayDate && (
                                <Text style={styles.crosshairDate}>{displayDate}</Text>
                            )}
                        </View>
                        {dataTier && (
                            <DataTierBadge tier={dataTier} label={dataTierLabel} />
                        )}
                    </View>
                </View>
            )}

            <View style={styles.chartWrapper}>
                <CartesianChart
                    data={chartData}
                    xKey="day"
                    yKeys={["close"]}
                    domain={{ y: yDomain }}
                    padding={compact ? 6 : 12}
                    chartPressState={pressState}
                    axisOptions={{
                        tickCount: compact ? 3 : 5,
                        labelColor: Theme.colors.textMuted,
                        labelOffset: compact ? 4 : 8,
                        lineColor: Theme.colors.glassBorder,
                        formatYLabel: (v) => `$${v}`,
                        font: undefined, // Uses default
                    }}
                    renderOutside={({ chartBounds }) => {
                        if (!pressPoint) return null;
                        return (
                            <>
                                <SkiaLine
                                    p1={vec(pressPoint.x, chartBounds.top)}
                                    p2={vec(pressPoint.x, chartBounds.bottom)}
                                    color={Theme.colors.glassBorder}
                                    strokeWidth={1}
                                />
                                <SkiaLine
                                    p1={vec(chartBounds.left, pressPoint.y)}
                                    p2={vec(chartBounds.right, pressPoint.y)}
                                    color={Theme.colors.glassBorder}
                                    strokeWidth={1}
                                />
                                <Circle
                                    cx={pressPoint.x}
                                    cy={pressPoint.y}
                                    r={3}
                                    color={Theme.colors.primary}
                                />
                            </>
                        );
                    }}
                >
                    {({ points, chartBounds, yScale }) => {
                        const resolveColor = (value: string | undefined, fallback: string) => value || fallback;
                        const lineColor = resolveColor(accentColor, Theme.colors.primary);
                        const buildLevelLine = (value: number | undefined, color: string, opacity = 0.5, strokeWidth = 1) => {
                            if (typeof value !== 'number') return null;
                            const y = yScale(value);
                            if (y < chartBounds.top || y > chartBounds.bottom) return null;
                            const linePoints = [
                                { x: chartBounds.left, y, xValue: chartBounds.left, yValue: value },
                                { x: chartBounds.right, y, xValue: chartBounds.right, yValue: value },
                            ];
                            return (
                                <Line
                                    points={linePoints}
                                    color={color}
                                    strokeWidth={strokeWidth}
                                    opacity={opacity}
                                />
                            );
                        };

                        const spotValue = typeof spotPrice === 'number' ? spotPrice : undefined;
                        const strikeValue = typeof strikePrice === 'number' ? strikePrice : undefined;
                        const spotY = spotValue !== undefined ? yScale(spotValue) : null;
                        const strikeY = strikeValue !== undefined ? yScale(strikeValue) : null;
                        const bandTop = spotY !== null && strikeY !== null ? Math.min(spotY, strikeY) : null;
                        const bandHeight = spotY !== null && strikeY !== null ? Math.abs(spotY - strikeY) : null;

                        return (
                            <>
                                {showVolumeProfile && maxVolume > 0 && volumeBins.length > 0 && (() => {
                                    const profileWidth = (chartBounds.right - chartBounds.left) * 0.25;
                                    const binHeight = (chartBounds.bottom - chartBounds.top) / volumeBins.length;
                                    return volumeBins.map((volume, index) => {
                                        if (volume <= 0) return null;
                                        const width = (volume / maxVolume) * profileWidth;
                                        const y = chartBounds.bottom - (index + 1) * binHeight;
                                        return (
                                            <Rect
                                                key={`volume-${index}`}
                                                x={chartBounds.left}
                                                y={y}
                                                width={width}
                                                height={Math.max(1, binHeight - 1)}
                                                color={Theme.colors.glassBorder + '55'}
                                            />
                                        );
                                    });
                                })()}

                                {bandTop !== null && bandHeight !== null && bandHeight > 0 && (
                                    <Rect
                                        x={chartBounds.left}
                                        y={bandTop}
                                        width={chartBounds.right - chartBounds.left}
                                        height={bandHeight}
                                        color={withAlpha(lineColor, '22')}
                                    />
                                )}

                                <Area
                                    points={points.close}
                                    y0={chartBounds.bottom}
                                    animate={{ type: 'timing', duration: Theme.motion.duration.medium }}
                                >
                                    <LinearGradient
                                        start={vec(chartBounds.left, chartBounds.top)}
                                        end={vec(chartBounds.left, chartBounds.bottom)}
                                        colors={[chartColor + '40', chartColor + '00']}
                                    />
                                </Area>

                                {sigma !== null && (
                                    <>
                                        {buildLevelLine(recentClose + sigma, Theme.colors.warning, 0.35)}
                                        {buildLevelLine(recentClose - sigma, Theme.colors.warning, 0.35)}
                                        {buildLevelLine(recentClose + (sigma * 2), Theme.colors.warning, 0.2)}
                                        {buildLevelLine(recentClose - (sigma * 2), Theme.colors.warning, 0.2)}
                                    </>
                                )}

                                {eventMarkers.map((event, i) => {
                                    const point = points.close[event.index];
                                    if (!point) return null;
                                    const tone = event.impact === 'high'
                                        ? Theme.colors.error
                                        : event.impact === 'medium'
                                            ? Theme.colors.warning
                                            : Theme.colors.glassBorder;
                                    const eventLabel = event.label || 'Event';
                                    return (
                                        <React.Fragment key={`event-${event.date}-${event.index}-${eventLabel}-${i}`}>
                                            <Line
                                                points={[
                                                    { x: point.x, y: chartBounds.top, xValue: point.xValue, yValue: chartBounds.top },
                                                    { x: point.x, y: chartBounds.bottom, xValue: point.xValue, yValue: chartBounds.bottom },
                                                ]}
                                                color={tone}
                                                strokeWidth={1}
                                                opacity={0.35}
                                            />
                                            <Circle
                                                cx={point.x}
                                                cy={chartBounds.bottom - 6}
                                                r={3}
                                                color={tone}
                                            />
                                        </React.Fragment>
                                    );
                                })}

                                {buildLevelLine(resistance, Theme.colors.error, 0.6)}
                                {buildLevelLine(purchasePrice, Theme.colors.textMuted, 0.6)}
                                {buildLevelLine(spotValue, Theme.colors.dataLive, 0.7, 1.5)}
                                {buildLevelLine(strikeValue, lineColor, 0.8, 1.5)}
                                {buildLevelLine(support, Theme.colors.success, 0.6)}

                                {spotY !== null && (
                                    <Circle
                                        cx={chartBounds.right}
                                        cy={spotY}
                                        r={3.5}
                                        color={Theme.colors.dataLive}
                                    />
                                )}

                                <Line
                                    points={points.close}
                                    color={chartColor}
                                    strokeWidth={2.5}
                                    animate={{ type: 'timing', duration: Theme.motion.duration.medium }}
                                />
                            </>
                        );
                    }}
                </CartesianChart>
                {(typeof resistance === 'number'
                    || typeof purchasePrice === 'number'
                    || typeof support === 'number'
                    || typeof spotPrice === 'number'
                    || typeof strikePrice === 'number') && (
                    <View style={styles.legendRow}>
                        {typeof spotPrice === 'number' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: Theme.colors.dataLive }]} />
                                <Text style={[styles.legendText, Theme.typography.numeric]}>SPOT ${spotPrice.toFixed(2)}</Text>
                            </View>
                        )}
                        {typeof strikePrice === 'number' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: accentColor || Theme.colors.primary }]} />
                                <Text style={[styles.legendText, Theme.typography.numeric]}>STRIKE ${strikePrice.toFixed(2)}</Text>
                            </View>
                        )}
                        {typeof resistance === 'number' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: Theme.colors.error }]} />
                                <Text style={[styles.legendText, Theme.typography.numeric]}>RES ${resistance.toFixed(2)}</Text>
                            </View>
                        )}
                        {typeof purchasePrice === 'number' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: Theme.colors.textMuted }]} />
                                <Text style={[styles.legendText, Theme.typography.numeric]}>COST ${purchasePrice.toFixed(2)}</Text>
                            </View>
                        )}
                        {typeof support === 'number' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: Theme.colors.success }]} />
                                <Text style={[styles.legendText, Theme.typography.numeric]}>SUPP ${support.toFixed(2)}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </>
    );

    if (!useContainer) {
        return (
            <View style={[styles.plainContainer, { height }]}>{renderContent()}</View>
        );
    }

    return (
        <GlassCard
            style={[styles.container, { height }]}
            contentStyle={contentStyles}
            useNativeGlass={false}
            useBlur={false}
        >
            {renderContent()}
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Theme.spacing.md,
        width: '100%',
        borderRadius: Theme.borderRadius.xl,
        overflow: 'visible',
    },
    content: {
        flex: 1,
        padding: Theme.spacing.sm,
    },
    contentCompact: {
        padding: Theme.spacing.xs,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    headerCompact: {
        paddingHorizontal: 0,
        marginBottom: Theme.spacing.xs,
    },
    headerRight: {
        alignItems: 'flex-end',
        gap: Theme.spacing.md_inner,
        flexShrink: 1,
    },
    headerMetrics: {
        flexDirection: 'row',
        gap: Theme.spacing.sm,
        alignItems: 'center',
    },
    title: {
        color: Theme.colors.textMuted,
        fontWeight: '600',
        fontSize: Theme.typography.sizes.sm,
    },
    currentPrice: {
        color: Theme.colors.text,
        fontWeight: 'bold',
        fontSize: Theme.typography.sizes.md,
    },
    crosshairDate: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xxs,
    },
    change: {
        fontWeight: 'bold',
        fontSize: Theme.typography.sizes.sm,
    },
    chartWrapper: {
        flex: 1,
        marginTop: Theme.spacing.xs,
    },
    plainContainer: {
        width: '100%',
        flex: 1,
    },
    errorText: {
        color: Theme.colors.textMuted,
        textAlign: 'center',
        marginTop: Theme.spacing.lg,
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.sm,
        marginTop: Theme.spacing.xs,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md_inner,
    },
    legendSwatch: {
        width: 8,
        height: 8,
        borderRadius: Theme.borderRadius.xs,
    },
    legendText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: '600',
    },
});
