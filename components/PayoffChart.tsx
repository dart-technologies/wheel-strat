import React, { memo, useMemo, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Line as SvgLine } from 'react-native-svg';
import { Theme } from '@/constants/theme';

export type PayoffPoint = {
    price: number;
    pnl: number;
};

type PayoffChartProps = {
    data: PayoffPoint[];
    height?: number;
};

const PayoffChart = memo(({ data, height = 180 }: PayoffChartProps) => {
    const [width, setWidth] = useState(0);

    const handleLayout = (event: LayoutChangeEvent) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth !== width) {
            setWidth(nextWidth);
        }
    };

    const { points, minPnl, maxPnl } = useMemo(() => {
        if (!data.length || width <= 0) {
            return { points: '', minPnl: 0, maxPnl: 0 };
        }
        const prices = data.map((point) => point.price);
        const pnls = data.map((point) => point.pnl);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const minValue = Math.min(...pnls);
        const maxValue = Math.max(...pnls);
        const priceRange = Math.max(1, maxPrice - minPrice);
        const pnlRange = Math.max(1, maxValue - minValue);
        const pointString = data.map((point) => {
            const x = ((point.price - minPrice) / priceRange) * width;
            const y = height - ((point.pnl - minValue) / pnlRange) * height;
            return `${x},${y}`;
        }).join(' ');
        return { points: pointString, minPnl: minValue, maxPnl: maxValue };
    }, [data, width, height]);

    const zeroLineY = useMemo(() => {
        if (width <= 0) return null;
        if (minPnl === maxPnl) return height / 2;
        if (minPnl > 0 || maxPnl < 0) return null;
        const range = Math.max(1, maxPnl - minPnl);
        return height - ((0 - minPnl) / range) * height;
    }, [width, minPnl, maxPnl, height]);

    return (
        <View style={[styles.container, { height }]} onLayout={handleLayout}>
            {width > 0 && points && (
                <Svg width={width} height={height}>
                    {zeroLineY !== null && (
                        <SvgLine
                            x1={0}
                            y1={zeroLineY}
                            x2={width}
                            y2={zeroLineY}
                            stroke={Theme.colors.glassBorder}
                            strokeWidth={1}
                        />
                    )}
                    <Polyline
                        points={points}
                        fill="none"
                        stroke={Theme.colors.primary}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                </Svg>
            )}
        </View>
    );
});

PayoffChart.displayName = 'PayoffChart';

export default PayoffChart;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: Theme.borderRadius.lg,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassSubtle,
    },
});
