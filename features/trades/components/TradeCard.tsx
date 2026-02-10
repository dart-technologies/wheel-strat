import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import { Trade } from '@wheel-strat/shared';
import GlassCard from '@/components/GlassCard';
import { getStrategyColor } from '@/utils/strategies';
import { formatCurrency } from '@/utils/format';
import PayoffGlyph from '@/components/PayoffGlyph';

interface TradeCardProps {
    trade: Trade;
    onPress?: () => void;
    showReplayIndicator?: boolean;
}

const toUpper = (value?: unknown) => (typeof value === 'string' ? value.toUpperCase() : '');

const resolveActionLabel = (trade: Trade) => {
    const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, unknown> : undefined;
    const rawAction = toUpper(raw?.action);
    if (rawAction === 'ROLL') return 'Roll';
    if (rawAction === 'CLOSE') return 'Close';
    if (rawAction === 'OPEN') return 'Open';
    if (rawAction === 'SELL') return 'Sell';
    if (rawAction === 'BUY') return 'Buy';

    switch (trade.type) {
        case 'SELL':
            return 'Sell';
        case 'BUY':
            return 'Buy';
        case 'CC':
        case 'CSP':
            return 'Sell';
        default:
            return trade.type;
    }
};

const TradeCard = memo(({ trade, onPress, showReplayIndicator }: TradeCardProps) => {
    const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, unknown> : undefined;
    const secType = toUpper(trade.secType ?? raw?.secType);
    const right = toUpper(trade.right ?? raw?.right);
    const hasStrike = Number.isFinite(Number(trade.strike ?? raw?.strike))
        && Number(trade.strike ?? raw?.strike) > 0;
    const hasExpiration = Boolean(trade.expiration ?? raw?.expiration ?? raw?.lastTradeDateOrContractMonth);
    const isOptionTrade = secType === 'OPT' || right || hasStrike || hasExpiration;
    const isCoveredCall = trade.type === 'CC' || right === 'C';
    const isCashSecuredPut = trade.type === 'CSP' || right === 'P';

    const accentColor = getStrategyColor(trade.type);
    const actionLabel = resolveActionLabel(trade);

    const showReplay = Boolean(onPress) && showReplayIndicator !== false;

    const multiplier = isOptionTrade ? (Number(trade.multiplier) || 100) : 1;
    const qty = Number(trade.quantity);
    const rawPrice = Number(trade.price);
    const fallbackPrice = Number(raw?.avgPrice ?? raw?.price);
    const rawTotal = Number(trade.total);
    const basePrice = (Number.isFinite(rawPrice) && rawPrice !== 0)
        ? rawPrice
        : (Number.isFinite(fallbackPrice) ? fallbackPrice : rawPrice);
    const computedTotal = Number.isFinite(basePrice) ? basePrice * qty * multiplier : NaN;
    const resolvedTotal = Number.isFinite(computedTotal) && computedTotal !== 0
        ? computedTotal
        : (Number.isFinite(rawTotal) ? rawTotal : computedTotal);
    const resolvedPrice = (Number.isFinite(basePrice) && basePrice !== 0)
        ? basePrice
        : (Number.isFinite(resolvedTotal) && qty !== 0 ? resolvedTotal / (qty * multiplier) : basePrice);

    const cardContent = (
        <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.iconContainer}>
                <View style={[
                    styles.iconCircle,
                    { backgroundColor: accentColor }
                ]}>
                    {(isOptionTrade && (isCoveredCall || isCashSecuredPut)) ? (
                        <PayoffGlyph
                            type={isCoveredCall ? 'cc' : 'csp'}
                            size={18}
                            color="white"
                        />
                    ) : (
                        <Ionicons
                            name="swap-vertical"
                            size={Theme.layout.iconSize.sm} // 16
                            color="white"
                        />
                    )}
                </View>
            </View>

            <View style={styles.details}>
                <View style={styles.row}>
                    <Text style={styles.symbol}>{trade.symbol}</Text>
                    <Text style={styles.total}>{formatCurrency(resolvedTotal)}</Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.meta}>
                        {trade.quantity} @ {formatCurrency(resolvedPrice)} · {trade.date}
                    </Text>
                    <View style={styles.rowRight}>
                        <View style={styles.actionPill}>
                            <Text style={styles.actionText}>{actionLabel}</Text>
                        </View>
                        {showReplay ? (
                            <Ionicons name="play-circle-outline" size={16} color={Theme.colors.textMuted} />
                        ) : null}
                    </View>
                </View>
            </View>
        </GlassCard>
    );

    return (
        <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            layout={LinearTransition}
        >
            {onPress ? (
                <Pressable
                    onPress={onPress}
                    style={({ pressed }) => ([
                        styles.pressable,
                        pressed ? styles.pressablePressed : null
                    ])}
                >
                    {cardContent}
                </Pressable>
            ) : (
                cardContent
            )}
        </Animated.View>
    );
});

export default TradeCard;

const styles = StyleSheet.create({
    pressable: {
        width: '100%',
    },
    pressablePressed: {
        opacity: 0.9,
    },
    card: {
        ...layout.flexRow('flex-start', 'stretch'),
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
        width: '100%',
    },
    cardContent: {
        ...layout.flexRow('flex-start', 'center'),
        padding: Theme.spacing.lg,
        width: '100%',
    },
    iconContainer: {
        marginRight: Theme.spacing.md,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        ...layout.center,
    },
    details: {
        flex: 1,
        minWidth: 0,
    },
    row: {
        ...layout.flexRow('space-between', 'center', 0),
        marginBottom: 2,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    symbol: {
        ...typography('base', 'bold'),
    },
    total: {
        ...typography('base', 'bold'),
    },
    meta: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    actionPill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    actionText: {
        ...typography('xs', 'bold'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    }
});
