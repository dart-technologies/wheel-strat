import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../constants/theme";
import GlassCard from "./GlassCard";

interface AlertCardProps {
    symbol: string;
    changePercent: number;
    previousClose: number;
    currentPrice: number;
    suggestedStrategy: string;
    onAction?: () => void;
    onDismiss?: () => void;
}

export default function AlertCard({
    symbol,
    changePercent,
    previousClose,
    currentPrice,
    suggestedStrategy,
    onAction,
    onDismiss
}: AlertCardProps) {
    const isUp = changePercent > 0;
    const directionIcon = isUp ? "trending-up" : "trending-down";
    const directionColor = isUp ? Theme.colors.success : Theme.colors.error;
    const changeStr = `${isUp ? '+' : ''}${(changePercent ?? 0).toFixed(2)}%`;

    return (
        <GlassCard style={styles.container} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: directionColor + '22' }]}>
                    <Ionicons name={directionIcon} size={20} color={directionColor} />
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.symbol}>{symbol}</Text>
                    <Text style={[styles.change, { color: directionColor }]}>{changeStr}</Text>
                </View>
                {onDismiss && (
                    <Pressable onPress={onDismiss} style={styles.dismissButton}>
                        <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
                    </Pressable>
                )}
            </View>

            <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Previous: </Text>
                <Text style={styles.priceValue}>${(previousClose ?? 0).toFixed(2)}</Text>
                <Ionicons name="arrow-forward" size={14} color={Theme.colors.textMuted} style={{ marginHorizontal: 8 }} />
                <Text style={styles.priceLabel}>Current: </Text>
                <Text style={[styles.priceValue, { color: directionColor }]}>${(currentPrice ?? 0).toFixed(2)}</Text>
            </View>

            <View style={styles.strategySection}>
                <Ionicons name="bulb-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.strategyText}>{suggestedStrategy}</Text>
            </View>

            {onAction && (
                <Pressable style={styles.actionButton} onPress={onAction}>
                    <Text style={styles.actionButtonText}>View Opportunity</Text>
                    <Ionicons name="arrow-forward" size={16} color={Theme.colors.white} />
                </Pressable>
            )}
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
    },
    cardContent: {
        padding: Theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Theme.spacing.md,
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Theme.spacing.sm,
    },
    symbol: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    change: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: 'bold',
    },
    dismissButton: {
        padding: Theme.spacing.xs,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    priceLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    priceValue: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: '600',
    },
    strategySection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: Theme.colors.glass,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.md,
    },
    strategyText: {
        flex: 1,
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: Theme.colors.primary,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    actionButtonText: {
        color: Theme.colors.white,
        fontWeight: 'bold',
        fontSize: Theme.typography.sizes.md,
    },
});
