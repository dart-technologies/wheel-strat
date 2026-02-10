import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { getStrategyColor, getStrategyAbbreviation } from '@/utils/strategies';

interface StrategyBadgeProps {
    strategy: string; // 'Covered Call', 'CSP', etc.
    compact?: boolean; // If true, shows 'CC' instead of 'Covered Call'
    style?: ViewStyle;
}

export default function StrategyBadge({ strategy, compact = true, style }: StrategyBadgeProps) {
    const color = getStrategyColor(strategy);
    const label = compact ? getStrategyAbbreviation(strategy) : strategy;

    return (
        <View style={[
            styles.badge, 
            { backgroundColor: color + '20' }, // 12% opacity roughly, or use '20' hex
            style
        ]}>
            <Text style={[styles.text, { color }]}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
    }
});
