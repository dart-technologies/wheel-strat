import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import GlassCard from '@/components/GlassCard';
import { LeaderboardEntry } from '@wheel-strat/shared';
import { formatPercent } from '@/utils/format';
import { typography } from '@/utils/styles';

type LeaderboardRowProps = {
    entry: LeaderboardEntry;
    rank: number;
    onPress?: () => void;
};

const rankColors = {
    1: Theme.colors.strategyCc,
    2: Theme.colors.primary,
    3: Theme.colors.strategyCsp
};

const KEYCAP_RANKS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const getRankKeycap = (rank: number) => KEYCAP_RANKS[rank - 1] || `${rank}`;

const maskDisplayName = (displayName?: string) => {
    if (!displayName) return 'Anon';
    return displayName.includes('@privaterelay.appleid.com') ? 'Anon' : displayName;
};

const LeaderboardRow = memo(({ entry, rank, onPress }: LeaderboardRowProps) => {
    const highlightColor = rankColors[rank as 1 | 2 | 3] || Theme.colors.glassBorder;
    const yieldText = Number.isFinite(entry.yieldPct) ? formatPercent(entry.yieldPct, 1) : '--';

    return (
        <Pressable onPress={onPress} disabled={!onPress}>
            <GlassCard style={[styles.card, { borderLeftColor: highlightColor }]} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                <View style={styles.rankContainer}>
                    <View style={[styles.rankBadge, { backgroundColor: highlightColor }]}>
                        <Text style={styles.rankText}>{getRankKeycap(rank)}</Text>
                    </View>
                </View>
                <View style={styles.info}>
                    <Text style={styles.name}>{maskDisplayName(entry.displayName)}</Text>
                    <Text style={styles.meta}>Avg realized yield</Text>
                </View>
                <View style={styles.metricColumn}>
                    <Text style={styles.metricLabel}>Trades</Text>
                    <Text style={styles.metricValue}>{entry.tradeCount}</Text>
                </View>
                <View style={styles.metrics}>
                    <Text style={styles.yieldLabel}>Yield</Text>
                    <Text style={styles.yieldValue}>{yieldText}</Text>
                </View>
            </GlassCard>
        </Pressable>
    );
});

export default LeaderboardRow;

const styles = StyleSheet.create({
    card: {
        borderRadius: Theme.borderRadius.lg,
        borderLeftWidth: 4,
        marginBottom: Theme.spacing.md,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.lg,
    },
    rankContainer: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        ...typography('sm', 'bold'),
        color: Theme.colors.white,
    },
    info: {
        flex: 1,
    },
    name: {
        ...typography('md', 'semibold'),
        color: Theme.colors.text,
        marginBottom: 2,
    },
    meta: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    metricColumn: {
        alignItems: 'flex-end',
        minWidth: 64,
        marginRight: Theme.spacing.md,
    },
    metricLabel: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    metricValue: {
        ...typography('md', 'bold'),
        color: Theme.colors.text,
    },
    metrics: {
        alignItems: 'flex-end',
    },
    yieldLabel: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    yieldValue: {
        ...typography('md', 'bold'),
        color: Theme.colors.success,
    },
});
