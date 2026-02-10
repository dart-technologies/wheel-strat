import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import PayoffGlyph from '@/components/PayoffGlyph';
import StrategyBadge from '@/features/opportunities/components/StrategyBadge';

interface OpportunityHeaderProps {
    symbol: string;
    strategy: string; // "Covered Call" or "Cash-Secured Put"
    strike?: number;
    priority?: number; // 1, 2, or 3
    accentColor: string;
}

const PRIORITY_BADGES = ['🥇', '🥈', '🥉'];

export default function OpportunityHeader({
    symbol,
    strategy,
    strike,
    priority,
    accentColor
}: OpportunityHeaderProps) {
    const isCoveredCall = strategy === "Covered Call";

    return (
        <View style={styles.header}>
            <View style={styles.titleRow}>
                {priority && priority <= 3 && (
                    <Text style={styles.priorityBadge}>{PRIORITY_BADGES[priority - 1]}</Text>
                )}
                <Text style={styles.symbol}>{symbol}</Text>
                {strike && <Text style={styles.strike}>${strike}</Text>}
            </View>
            <View style={styles.strategyStack}>
                <PayoffGlyph type={isCoveredCall ? 'cc' : 'csp'} color={accentColor} />
                <StrategyBadge strategy={strategy} compact />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: layout.flexRow('space-between', 'center', Theme.spacing.sm),
    titleRow: layout.flexRow('flex-start', 'center', Theme.spacing.xs),
    strategyStack: layout.flexRow('flex-end', 'center', Theme.spacing.xs),
    priorityBadge: {
        fontSize: Theme.typography.sizes.xl,
        marginRight: Theme.spacing.xxs,
    },
    symbol: {
        ...typography('xl', 'bold'),
        color: Theme.colors.text,
    },
    strike: {
        ...typography('lg', 'regular'),
        color: Theme.colors.textMuted,
        marginLeft: Theme.spacing.xxs,
    },
});
