import React from 'react';
import { Text, TextStyle, StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { formatPercent, formatCurrency } from '@/utils/format';

interface TrendTextProps {
    value: number;
    type?: 'percent' | 'currency' | 'number';
    withSign?: boolean;
    style?: TextStyle;
    textStyle?: TextStyle;
    decimals?: number;
    showBackground?: boolean;
}

export default function TrendText({
    value,
    type = 'percent',
    withSign = false,
    style,
    decimals,
    showBackground = false
}: TrendTextProps) {
    const isPositive = value >= 0;
    const isZero = Math.abs(value) < 0.0001;
    
    // Determine color
    let color = Theme.colors.text;
    if (!isZero) {
        color = isPositive ? Theme.colors.profit : Theme.colors.loss;
    }

    // Format text
    let formatted = '';
    if (type === 'percent') {
        formatted = formatPercent(Math.abs(value), decimals ?? 1);
    } else if (type === 'currency') {
        formatted = formatCurrency(Math.abs(value));
    } else {
        formatted = Math.abs(value).toFixed(decimals ?? 2);
    }

    if (withSign && !isZero) {
        formatted = `${isPositive ? '+' : '-'}${formatted}`;
    } else if (value < 0 && !withSign) {
        // Handle negative numbers naturally if sign not forced (but we abs'd above so we need to add it back if we want standard negative formatting without explicit +)
        // Actually, if withSign is false, usually we just show the number. If it's currency/percent, we often want the sign. 
        // Let's stick to: withSign forces + or -. If false, we might want standard negative notation.
        // For this component, typically used for P&L, we usually want explicit signs or at least color indicating direction.
        // If type is currency and value is -5, we want -$5.00 usually.
         if (type === 'currency' || type === 'percent') {
             formatted = type === 'currency' 
                ? formatCurrency(value).replace('$-', '-$') // Fix potentially weird formatting
                : formatPercent(value, decimals ?? 1);
         } else {
             formatted = value.toFixed(decimals ?? 2);
         }
    }
    
    // Refined formatting logic to ensure simplicity:
    // If we want explicit signs (common for change%), we use abs and prepend + or -.
    // If we just want colored text (like a balance that happens to be negative), we let standard formatting handle the negative sign.
    if (withSign) {
        formatted = `${value > 0 ? '+' : ''}${type === 'currency' ? formatCurrency(value) : (type === 'percent' ? formatPercent(value, decimals ?? 1) : value.toFixed(decimals ?? 2))}`;
    } else {
         formatted = type === 'currency' ? formatCurrency(value) : (type === 'percent' ? formatPercent(value, decimals ?? 1) : value.toFixed(decimals ?? 2));
    }


    if (showBackground) {
        return (
            <View style={[
                styles.pill, 
                { backgroundColor: isPositive ? Theme.colors.successWash : Theme.colors.errorWash },
                style as ViewStyle
            ]}>
                <Text style={[styles.text, { color }, style]}>
                    {formatted}
                </Text>
            </View>
        );
    }

    return (
        <Text style={[styles.text, { color }, style]}>
            {formatted}
        </Text>
    );
}

const styles = StyleSheet.create({
    text: {
        fontWeight: Theme.typography.weights.bold,
    },
    pill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        alignSelf: 'flex-start',
    }
});
