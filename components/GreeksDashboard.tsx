import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { typography, layout } from '../utils/styles';
import GlassCard from './GlassCard';

interface GreeksDashboardProps {
    greeks?: {
        delta?: number;
        gamma?: number;
        theta?: number;
        vega?: number;
    };
    title?: string;
    showDescriptions?: boolean;
}

export default function GreeksDashboard({ 
    greeks, 
    title = "Real-time Greeks",
    showDescriptions = false 
}: GreeksDashboardProps) {
    const { width } = useWindowDimensions();
    const isWide = width >= 520;
    const statBoxStyle = useMemo(() => ({
        width: (isWide ? '23%' : '46%') as `${number}%`
    }), [isWide]);
    
    const formatGreek = (value: number | undefined, decimals: number) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
        return value.toFixed(decimals);
    };

    return (
        <GlassCard style={styles.sectionCard} blurIntensity={Theme.blur.subtle}>
            <View style={styles.sectionHeader}>
                <Ionicons name="calculator-outline" size={16} color={Theme.colors.secondary} />
                <Text style={styles.sectionTitle} numberOfLines={1}>
                    {title}
                </Text>
            </View>
            <View style={styles.statsGrid}>
                <View style={[styles.statBox, statBoxStyle]}>
                    <Text style={styles.statLabel}>DELTA</Text>
                    <Text style={[styles.statValue, { color: Theme.colors.text }]}>
                        {formatGreek(greeks?.delta, 2)}
                    </Text>
                    {showDescriptions && <Text style={styles.statDesc}>Sensitivity</Text>}
                </View>
                <View style={[styles.statBox, statBoxStyle]}>
                    <Text style={styles.statLabel}>GAMMA</Text>
                    <Text style={[styles.statValue, { color: Theme.colors.text }]}>
                        {formatGreek(greeks?.gamma, 3)}
                    </Text>
                    {showDescriptions && <Text style={styles.statDesc}>Acceleration</Text>}
                </View>
                <View style={[styles.statBox, statBoxStyle]}>
                    <Text style={styles.statLabel}>THETA</Text>
                    <Text style={[styles.statValue, { color: Theme.colors.profit }]}>
                        {formatGreek(greeks?.theta, 2)}
                    </Text>
                    {showDescriptions && <Text style={styles.statDesc}>Time Decay</Text>}
                </View>
                <View style={[styles.statBox, statBoxStyle]}>
                    <Text style={styles.statLabel}>VEGA</Text>
                    <Text style={[styles.statValue, { color: Theme.colors.text }]}>
                        {formatGreek(greeks?.vega, 2)}
                    </Text>
                    {showDescriptions && <Text style={styles.statDesc}>Volatility</Text>}
                </View>
            </View>
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    sectionCard: {
        marginBottom: Theme.layout.elementGap,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    sectionHeader: {
        ...layout.flexRow('flex-start', 'center', 6),
        marginBottom: Theme.spacing.sm,
    },
    sectionTitle: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statBox: {
        paddingVertical: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.xs,
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    statLabel: {
        ...typography('xs', 'semibold'),
        color: Theme.colors.textMuted,
        marginBottom: 4,
        textAlign: 'center',
    },
    statValue: {
        ...typography('base', 'bold'),
    },
    statDesc: {
        ...typography('xxs', 'regular'),
        color: Theme.colors.textSubtle,
        marginTop: 2,
        textAlign: 'center',
    }
});
