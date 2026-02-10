import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { Theme } from '@/constants/theme';
import type { RiskLevel } from '@wheel-strat/shared';

type RiskSpeedometerProps = {
    delta?: number | null;
    riskLevel?: RiskLevel;
    size?: number;
};

type RiskBand = {
    green: number;
    yellow: number;
};

const RISK_BANDS: Record<RiskLevel, RiskBand> = {
    Aggressive: { green: 0.45, yellow: 0.55 },
    Moderate: { green: 0.30, yellow: 0.45 },
    Conservative: { green: 0.15, yellow: 0.25 }
};

const startAngle = -90;
const endAngle = 90;

const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180.0);
    return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians)),
    };
};

const describeArc = (cx: number, cy: number, radius: number, startDeg: number, endDeg: number) => {
    const start = polarToCartesian(cx, cy, radius, endDeg);
    const end = polarToCartesian(cx, cy, radius, startDeg);
    const largeArcFlag = endDeg - startDeg <= 180 ? "0" : "1";
    return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
};

export default function RiskSpeedometer({
    delta,
    riskLevel = 'Moderate',
    size = 180
}: RiskSpeedometerProps) {
    const normalizedDelta = useMemo(() => {
        const value = typeof delta === 'number' ? Math.abs(delta) : null;
        if (value === null || !Number.isFinite(value)) return null;
        return Math.min(1, value);
    }, [delta]);

    const band = RISK_BANDS[riskLevel];
    const greenMax = band.green;
    const yellowMax = band.yellow;

    const segments = useMemo(() => ([
        { start: 0, end: greenMax, color: Theme.colors.success },
        { start: greenMax, end: yellowMax, color: Theme.colors.warning },
        { start: yellowMax, end: 1, color: Theme.colors.error }
    ]), [greenMax, yellowMax]);

    const gaugeWidth = size;
    const radius = (size - 24) / 2;
    const center = { x: gaugeWidth / 2, y: gaugeWidth / 2 };
    const strokeWidth = 12;
    const valueAngle = normalizedDelta !== null
        ? startAngle + ((endAngle - startAngle) * normalizedDelta)
        : startAngle;
    const needleEnd = polarToCartesian(center.x, center.y, radius - 6, valueAngle);

    const assignmentProb = normalizedDelta !== null
        ? Math.round(normalizedDelta * 100)
        : null;

    const riskLabel = normalizedDelta === null
        ? 'Awaiting Delta'
        : normalizedDelta <= greenMax
            ? 'Comfortable'
            : normalizedDelta <= yellowMax
                ? 'Caution'
                : 'High Risk';

    const riskColor = normalizedDelta === null
        ? Theme.colors.textMuted
        : normalizedDelta <= greenMax
            ? Theme.colors.success
            : normalizedDelta <= yellowMax
                ? Theme.colors.warning
                : Theme.colors.error;

    return (
        <View style={styles.container}>
            <Svg width={gaugeWidth} height={gaugeWidth / 2 + 12}>
                {segments.map((segment, index) => (
                    <Path
                        key={`segment-${index}`}
                        d={describeArc(
                            center.x,
                            center.y,
                            radius,
                            startAngle + ((endAngle - startAngle) * segment.start),
                            startAngle + ((endAngle - startAngle) * segment.end)
                        )}
                        stroke={segment.color}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                    />
                ))}
                {normalizedDelta !== null && (
                    <Line
                        x1={center.x}
                        y1={center.y}
                        x2={needleEnd.x}
                        y2={needleEnd.y}
                        stroke={Theme.colors.text}
                        strokeWidth={2}
                    />
                )}
                <Circle cx={center.x} cy={center.y} r={4} fill={Theme.colors.text} />
            </Svg>
            <View style={styles.labelStack}>
                <Text style={styles.label}>Assignment Probability</Text>
                <Text style={[styles.value, { color: riskColor }]}>
                    {assignmentProb !== null ? `${assignmentProb}%` : '--'}
                </Text>
                <Text style={[styles.hint, { color: riskColor }]}>{riskLabel}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: Theme.spacing.sm,
    },
    labelStack: {
        alignItems: 'center',
        marginTop: -Theme.spacing.sm,
    },
    label: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
        fontWeight: Theme.typography.weights.semibold,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
        marginTop: Theme.spacing.xs,
    },
    hint: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        marginTop: Theme.spacing.xs,
    }
});
