import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import { OpportunityTechnicalLevel, OpportunityMetrics, OpportunityTechnicals } from '@wheel-strat/shared';

interface TechnicalLevelsProps {
    symbol: string;
    strike?: number;
    currentPrice?: number;
    technicals?: OpportunityTechnicals;
    metrics?: OpportunityMetrics;
    supportOverride?: string | number;
    resistanceOverride?: string | number;
    patternOverride?: string | null;
}

export default function TechnicalLevels({
    symbol,
    strike,
    currentPrice,
    technicals,
    metrics,
    supportOverride,
    resistanceOverride,
    patternOverride
}: TechnicalLevelsProps) {
    const formatLevel = (level?: OpportunityTechnicalLevel[] | OpportunityTechnicalLevel | string) => {
        if (!level) return undefined;
        if (Array.isArray(level)) {
            const first = level[0];
            if (!first) return undefined;
            if (typeof first === 'string') return first;
            return first.level ?? first.type;
        }
        if (typeof level === 'object') {
            return level.level ?? level.type;
        }
        return level;
    };

    const supportLevel = formatLevel(technicals?.support) ?? supportOverride;
    const resistanceLevel = formatLevel(technicals?.resistance) ?? resistanceOverride;
    const patternValue = technicals?.pattern;
    const patternText = typeof patternValue === 'object'
        ? patternValue.pattern
        : patternValue ?? patternOverride ?? null;

    // Animation for Range
    const progress = useSharedValue(0);

    useEffect(() => {
        if (metrics?.yearLow && metrics?.yearHigh && currentPrice) {
            const range = metrics.yearHigh - metrics.yearLow;
            if (range > 0) {
                const pct = ((currentPrice - metrics.yearLow) / range) * 100;
                const clamped = Math.min(100, Math.max(0, pct));
                progress.value = withDelay(300, withSpring(clamped));
            }
        }
    }, [metrics, currentPrice]);

    const fillStyle = useAnimatedStyle(() => ({
        width: `${progress.value}%`
    }));

    const thumbStyle = useAnimatedStyle(() => ({
        left: `${progress.value}%`
    }));

    return (
        <View style={styles.technicalsContainer}>
            {/* Price Context */}
            {(currentPrice || (symbol && strike)) && (
                <View style={styles.techRow}>
                    <Text style={styles.techLabel}>Key Levels</Text>
                    <View style={styles.priceContext}>
                        <Text style={[styles.techValue, { color: Theme.colors.error }]}>
                            S: {supportLevel ?? '--'}
                        </Text>
                        <View style={styles.priceDot} />
                        <Text style={[styles.techValue, { color: Theme.colors.success }]}>
                            R: {resistanceLevel ?? '--'}
                        </Text>
                    </View>
                </View>
            )}

            {/* 52-Week Range Visualization */}
            {metrics?.yearLow && metrics?.yearHigh && currentPrice && (
                <View style={styles.rangeContainer}>
                    <View style={styles.rangeRow}>
                        <Text style={styles.rangeLabel}>52W Low: ${metrics.yearLow}</Text>
                        <Text style={styles.rangeLabel}>High: ${metrics.yearHigh}</Text>
                    </View>
                    <View style={styles.rangeTrack}>
                        <Animated.View style={[styles.rangeFill, fillStyle, { backgroundColor: Theme.colors.dataDerived }]} />
                        <Animated.View style={[styles.rangeThumb, thumbStyle, { backgroundColor: Theme.colors.text }]} />
                    </View>
                </View>
            )}

            <View style={[styles.techRow, styles.techRowWrap]}>
                <Text style={styles.techLabel}>Pattern</Text>
                <Text
                    style={[styles.techValue, styles.techValueWrap]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                >
                    {patternText || '--'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    technicalsContainer: {
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
    },
    techRow: layout.flexRow('space-between', 'center'),
    techRowWrap: {
        alignItems: 'flex-start',
    },
    priceContext: layout.flexRow('center', 'center', Theme.spacing.sm),
    priceDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Theme.colors.textMuted,
    },
    techLabel: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    techValue: {
        ...typography('sm', 'bold'),
        color: Theme.colors.text,
    },
    techValueWrap: {
        flex: 1,
        textAlign: 'right',
    },
    rangeContainer: {
        marginVertical: Theme.spacing.xs,
    },
    rangeRow: {
        ...layout.flexRow('space-between', 'center', 0),
        marginBottom: Theme.spacing.xs,
    },
    rangeLabel: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    rangeTrack: {
        height: 4,
        backgroundColor: Theme.colors.glassBorder,
        borderRadius: Theme.borderRadius.full,
        position: 'relative',
    },
    rangeFill: {
        height: '100%',
        borderRadius: Theme.borderRadius.full,
    },
    rangeThumb: {
        position: 'absolute',
        top: -3,
        width: 10,
        height: 10,
        borderRadius: Theme.borderRadius.full,
        marginLeft: -5,
        borderWidth: 2,
        borderColor: Theme.colors.surface,
    },
});
