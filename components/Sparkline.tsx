import React, { memo, useMemo } from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { Theme } from '@/constants/theme';

type SparklineProps = {
    data: number[];
    width?: number;
    height?: number;
    stroke?: string;
    strokeWidth?: number;
};

const Sparkline = memo(({
    data,
    width = 80,
    height = 24,
    stroke = Theme.colors.success,
    strokeWidth = 2,
}: SparklineProps) => {
    const points = useMemo(() => {
        if (!data || data.length < 2) return '';
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = Math.max(1, max - min);
        return data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');
    }, [data, width, height]);

    if (!points) return null;

    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Polyline
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
});

Sparkline.displayName = 'Sparkline';

export default Sparkline;
