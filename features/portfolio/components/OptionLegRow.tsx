import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import PayoffGlyph from '@/components/PayoffGlyph';
import { OptionPosition } from '@wheel-strat/shared';
import { formatCurrency } from '@/utils/format';

interface OptionLegRowProps {
    leg: OptionPosition;
}

const formatExpiration = (value?: string) => {
    if (!value) return '--';
    const compact = value.replace(/-/g, '');
    if (compact.length === 8) {
        const year = compact.slice(0, 4);
        const month = compact.slice(4, 6);
        const day = compact.slice(6, 8);
        return `${month}/${day}/${year.slice(2)}`;
    }
    return value;
};

const OptionLegRow = memo(({ leg }: OptionLegRowProps) => {
    const right = (leg.right || '').toUpperCase();
    const isCall = right === 'C';
    const isPut = right === 'P';
    const sideLabel = leg.quantity < 0 ? 'Short' : 'Long';
    const typeLabel = isCall ? 'Call' : isPut ? 'Put' : 'Option';
    const strikeLabel = typeof leg.strike === 'number' ? formatCurrency(leg.strike) : '--';
    const expirationLabel = formatExpiration(leg.expiration);
    const qty = Math.abs(leg.quantity || 0);
    const premiumLabel = typeof leg.averageCost === 'number'
        ? formatCurrency(leg.averageCost)
        : '--';
    const glyphType = isCall ? 'cc' : 'csp';
    const glyphColor = isCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;

    return (
        <View style={styles.row}>
            <View style={styles.left}>
                <View style={[styles.glyphWrap, { backgroundColor: glyphColor + '20' }]}>
                    <PayoffGlyph type={glyphType} size={14} color={glyphColor} />
                </View>
                <View>
                    <Text style={styles.title}>{sideLabel} {typeLabel}</Text>
                    <Text style={styles.subtitle}>{strikeLabel} • {expirationLabel}</Text>
                </View>
            </View>
            <View style={styles.right}>
                <Text style={styles.qty}>{qty}x</Text>
                <Text style={styles.price}>{premiumLabel}</Text>
            </View>
        </View>
    );
});

OptionLegRow.displayName = 'OptionLegRow';

export default OptionLegRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.glass,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.sm,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    glyphWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    subtitle: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    right: {
        alignItems: 'flex-end',
    },
    qty: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
    },
    price: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
        marginTop: 2,
    },
});
