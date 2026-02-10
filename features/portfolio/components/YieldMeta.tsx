import React, { memo } from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { formatCurrency, formatPercent } from '@/utils/format';

interface YieldMetaProps {
    label?: string;
    yieldValue?: number;
    premium?: number;
    strike?: number;
    premiumSource?: string;
    medal?: string;
    accentColor?: string;
    size?: 'sm' | 'md';
    style?: ViewStyle;
}

const formatPremium = (value?: number, source?: string) => {
    if (typeof value !== 'number') return '--';
    let suffix = '';
    if (source === 'model' || source?.includes('calculated')) suffix = ' est.';
    else if (source === 'delayed') suffix = ' (15m)';
    else if (source === 'historical') suffix = ' (stale)';
    return `${formatCurrency(value)}${suffix}`;
};

const formatStrike = (value?: number) => (
    typeof value === 'number' ? formatCurrency(value) : '--'
);

const buildMeta = (premiumValue?: number, premiumSource?: string, strikeValue?: number) => {
    const premiumLabel = formatPremium(premiumValue, premiumSource);
    const strikeLabel = formatStrike(strikeValue);
    if (premiumLabel === '--' && strikeLabel === '--') return '--';
    if (premiumLabel === '--') return `Strike ${strikeLabel}`;
    if (strikeLabel === '--') return `Premium ${premiumLabel}`;
    return `${premiumLabel} @ ${strikeLabel}`;
};

const YieldMeta = memo(({
    label,
    yieldValue,
    premium,
    strike,
    premiumSource,
    medal,
    accentColor,
    size = 'md',
    style
}: YieldMetaProps) => {
    const fontSizes = size === 'sm'
        ? { label: Theme.typography.sizes.xs - 1, main: Theme.typography.sizes.sm, meta: Theme.typography.sizes.xs - 1 } // 9, 12, 9
        : { label: Theme.typography.sizes.xs, main: Theme.typography.sizes.md, meta: Theme.typography.sizes.xs }; // 10, 14, 10

    const yieldText = typeof yieldValue === 'number' ? formatPercent(yieldValue, 1) : '--';

    return (
        <View style={style}>
            {label && (
                <Text style={[styles.label, { fontSize: fontSizes.label }]}>
                    {label}
                </Text>
            )}
            <Text style={[
                styles.value,
                { fontSize: fontSizes.main, color: accentColor || Theme.colors.text }
            ]}>
                {medal ? `${medal} ` : ''}{yieldText}
            </Text>
            <Text style={[styles.meta, { fontSize: fontSizes.meta }]}>
                {buildMeta(premium, premiumSource, strike)}
            </Text>
        </View>
    );
});

YieldMeta.displayName = 'YieldMeta';

export default YieldMeta;

const styles = StyleSheet.create({
    label: {
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.textMuted,
        marginBottom: 2,
    },
    value: {
        fontWeight: Theme.typography.weights.extraBold,
    },
    meta: {
        marginTop: 2,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        fontWeight: Theme.typography.weights.semibold,
    }
});
