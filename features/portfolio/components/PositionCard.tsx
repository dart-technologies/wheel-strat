import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import GlassCard from '@/components/GlassCard';
import { Theme } from '@/constants/theme';
import { typography, layout, shadow } from '@/utils/styles';
import PayoffGlyph from '@/components/PayoffGlyph';
import YieldMeta from './YieldMeta';
import TrendText from './TrendText';
import { formatCurrency, parseNumber } from '@/utils/format';

interface PositionCardProps {
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    closePrice?: number;
    source?: string;
    cspYield?: number;
    ccYield?: number;
    cspPremium?: number;
    ccPremium?: number;
    cspStrike?: number;
    ccStrike?: number;
    cspPremiumSource?: string;
    ccPremiumSource?: string;
    cspMedal?: string;
    ccMedal?: string;
}

const PositionCard = memo(({
    symbol,
    quantity,
    averageCost,
    currentPrice,
    closePrice,
    source,
    cspYield,
    ccYield,
    cspPremium,
    ccPremium,
    cspStrike,
    ccStrike,
    cspPremiumSource,
    ccPremiumSource,
    cspMedal,
    ccMedal
}: PositionCardProps) => {
    const isProfitable = currentPrice >= averageCost;
    const gainLossPercent = ((currentPrice - averageCost) / averageCost) * 100;

    const costBasis = averageCost * quantity;
    const dailyPnl = typeof closePrice === 'number' && Number.isFinite(closePrice)
        ? (currentPrice - closePrice) * quantity
        : null;

    const cspYieldValue = parseNumber(cspYield);
    const ccYieldValue = parseNumber(ccYield);
    const cspPremiumValue = parseNumber(cspPremium);
    const ccPremiumValue = parseNumber(ccPremium);
    const cspStrikeValue = parseNumber(cspStrike);
    const ccStrikeValue = parseNumber(ccStrike);

    const showCsp = typeof cspYieldValue === 'number';
    const showCc = typeof ccYieldValue === 'number';

    const layoutTransition = LinearTransition.duration(Theme.motion.duration.slow)
        .easing(Easing.out(Easing.cubic));

    return (
        <Animated.View
            layout={layoutTransition}
            testID="position-card"
        >
            <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                <View style={styles.topRow}>
                    <View style={styles.symbolBlock}>
                        <Text style={styles.symbol}>{symbol}</Text>
                        <Text style={styles.details}>{quantity} shares • Avg {formatCurrency(averageCost)}</Text>
                        <Text style={styles.costBasis}>Cost Basis {formatCurrency(costBasis)}</Text>
                    </View>
                    <View style={styles.rightSide}>
                        <Text style={styles.price}>{formatCurrency(currentPrice)}</Text>
                        <TrendText
                            value={gainLossPercent}
                            type="percent"
                            showBackground
                            style={{ marginTop: Theme.spacing.xs }}
                        />
                        {dailyPnl !== null ? (
                            <View style={styles.dayPnlRow}>
                                <Text style={styles.dayPnlLabel}>Day</Text>
                                <TrendText value={dailyPnl} type="currency" withSign />
                            </View>
                        ) : (
                            <Text style={styles.dayPnlPlaceholder}>Day —</Text>
                        )}
                    </View>
                </View>

                {source && (
                    <View style={[styles.sourceBadge, source === 'historical' ? styles.sourceStale : styles.sourceDelayed]}>
                        <Text style={styles.sourceText}>
                            {source === 'historical' ? '⚠️ Stale Data' : '🕒 15m Delayed'}
                        </Text>
                    </View>
                )}
                {(showCsp || showCc) && (
                    <View style={styles.yieldRow}>
                        {showCsp && (
                            <View style={[styles.yieldBox, styles.yieldBoxCsp, styles.yieldButton]}>
                                <View style={styles.yieldHeader}>
                                    <PayoffGlyph type="csp" size={16} color={Theme.colors.strategyCsp} />
                                    <YieldMeta
                                        label="CSP Yield"
                                        yieldValue={cspYieldValue}
                                        premium={cspPremiumValue}
                                        premiumSource={cspPremiumSource}
                                        strike={cspStrikeValue}
                                        medal={cspMedal}
                                        accentColor={Theme.colors.strategyCsp}
                                        size="sm"
                                    />
                                </View>
                            </View>
                        )}
                        {showCc && (
                            <View style={[styles.yieldBox, styles.yieldBoxCc, styles.yieldButton]}>
                                <View style={styles.yieldHeader}>
                                    <PayoffGlyph type="cc" size={16} color={Theme.colors.strategyCc} />
                                    <YieldMeta
                                        label="CC Yield"
                                        yieldValue={ccYieldValue}
                                        premium={ccPremiumValue}
                                        premiumSource={ccPremiumSource}
                                        strike={ccStrikeValue}
                                        medal={ccMedal}
                                        accentColor={Theme.colors.strategyCc}
                                        size="sm"
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </GlassCard>
        </Animated.View>
    );
});

export default PositionCard;

const styles = StyleSheet.create({
    card: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
        overflow: 'hidden',
    },
    sourceBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: Theme.spacing.xs,
        paddingVertical: 2,
        borderBottomLeftRadius: Theme.borderRadius.sm,
    },
    sourceDelayed: {
        backgroundColor: Theme.colors.warning + '33', // 20% opacity
    },
    sourceStale: {
        backgroundColor: Theme.colors.error + '33',
    },
    sourceText: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.textMuted,
    },
    cardContent: {
        padding: Theme.layout.cardPadding,
    },
    topRow: {
        ...layout.flexRow('space-between', 'center'),
        marginBottom: Theme.spacing.md,
    },
    symbolBlock: {
        gap: Theme.spacing.xxs,
    },
    symbol: {
        ...typography('lg', 'extraBold'),
        color: Theme.colors.text,
    },
    details: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    costBasis: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    rightSide: {
        alignItems: 'flex-end',
    },
    price: {
        ...typography('base', 'bold'),
        color: Theme.colors.text,
    },
    dayPnlRow: {
        ...layout.flexRow('flex-end', 'center', Theme.spacing.xs),
        marginTop: Theme.spacing.xs,
    },
    dayPnlLabel: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    dayPnlPlaceholder: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.textMuted,
        marginTop: Theme.spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    yieldRow: {
        ...layout.flexRow('flex-start', 'stretch', Theme.spacing.sm),
        paddingTop: Theme.spacing.sm,
    },
    yieldButton: {
        ...shadow('sm'),
    },
    yieldBox: {
        flex: 1,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.glass,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    yieldHeader: {
        ...layout.flexRow('flex-start', 'center', Theme.spacing.sm),
    },
    yieldBoxCsp: {
        backgroundColor: Theme.colors.strategyCspWash,
    },
    yieldBoxCc: {
        backgroundColor: Theme.colors.strategyCcWash,
    },
});
