import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GlassCard from '@/components/GlassCard';
import { Theme } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

interface OptionGroupCardProps {
    symbol: string;
    contractCount: number;
    marketValue: number;
}

const OptionGroupCard = memo(({ symbol, contractCount, marketValue }: OptionGroupCardProps) => {
    const value = Number.isFinite(marketValue) ? marketValue : 0;
    const valueLabel = `${value >= 0 ? '' : '-'}${formatCurrency(Math.abs(value))}`;

    return (
        <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.topRow}>
                <View>
                    <Text style={styles.symbol}>{symbol}</Text>
                    <Text style={styles.details}>Options only • {contractCount} contracts</Text>
                </View>
                <View style={styles.rightSide}>
                    <Text style={styles.valueLabel}>Est. Value</Text>
                    <Text style={styles.value}>{valueLabel}</Text>
                </View>
            </View>
        </GlassCard>
    );
});

OptionGroupCard.displayName = 'OptionGroupCard';

export default OptionGroupCard;

const styles = StyleSheet.create({
    card: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
        overflow: 'hidden',
    },
    cardContent: {
        padding: Theme.layout.cardPadding,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    symbol: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.extraBold,
        color: Theme.colors.text,
    },
    details: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
        marginTop: 4,
    },
    rightSide: {
        alignItems: 'flex-end',
    },
    valueLabel: {
        fontSize: Theme.typography.sizes.xxs,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: Theme.colors.textMuted,
    },
    value: {
        fontSize: Theme.typography.sizes.base,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
        marginTop: 4,
    },
});
