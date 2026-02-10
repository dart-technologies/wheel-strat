import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import GlassCard from '@/components/GlassCard';
import PayoffGlyph from '@/components/PayoffGlyph';
import GreeksDashboard from '@/components/GreeksDashboard';
import { useExecuteOpportunity } from '@/hooks/useExecuteOpportunity';

interface WheelActionDetailModalProps {
    isVisible: boolean;
    onClose: () => void;
    symbol: string;
    strategy: string;
    strike: number;
    expiration: string;
    premium: number;
    yield: string;
    winProb: string;
    greeks?: {
        delta?: number;
        gamma?: number;
        theta?: number;
        vega?: number;
    };
    currentOption?: {
        strike?: number;
        expiration?: string;
        averageCost?: number;
        currentPrice?: number;
        quantity?: number;
        right?: string;
        multiplier?: number;
        theta?: number;
    };
    underlyingPrice?: number;
}

export default function WheelActionDetailModal({
    isVisible,
    onClose,
    symbol,
    strategy,
    strike,
    expiration,
    premium,
    yield: actionYield,
    winProb,
    greeks
}: WheelActionDetailModalProps) {
    const { executeOpportunity, executing } = useExecuteOpportunity();
    const isCoveredCall = strategy.toLowerCase().includes('call');
    const strategyColor = isCoveredCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;

    const handleExecute = () => {
        executeOpportunity({
            symbol,
            strategy,
            strike,
            expiration,
            premium
        }, {
            source: 'Wheel Action Execution',
            confirmTitle: 'Confirm Order',
            confirmActionLabel: 'Submit Order',
            onStart: () => onClose(),
            onSuccess: () => onClose()
        });
    };

    return (
        <Modal visible={isVisible} transparent animationType="slide">
            <View style={styles.overlay}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

                <GlassCard style={styles.container} contentStyle={styles.containerContent} blurIntensity={Theme.blur.medium}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <PayoffGlyph type={isCoveredCall ? 'cc' : 'csp'} size={32} color={strategyColor} />
                            <View>
                                <Text style={styles.headerTitle}>{strategy}</Text>
                                <Text style={styles.headerSubtitle}>{symbol} • {expiration} • ${strike} Strike</Text>
                            </View>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="chevron-down" size={24} color={Theme.colors.text} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {/* Summary Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Est. Premium</Text>
                                <Text style={styles.statValue}>${((premium ?? 0) * 100).toFixed(0)}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Win Prob</Text>
                                <Text style={[styles.statValue, { color: Theme.colors.success }]}>{winProb}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Ann. Yield</Text>
                                <Text style={[styles.statValue, { color: strategyColor }]}>{actionYield}</Text>
                            </View>
                        </View>

                        {/* Shared Greeks Dashboard */}
                        <GreeksDashboard greeks={greeks} title="Live Greeks" showDescriptions />

                        <View style={[
                            styles.infoCard,
                            { backgroundColor: isCoveredCall ? Theme.colors.strategyCcWash : Theme.colors.strategyCspWash }
                        ]}>
                            <Ionicons name="information-circle-outline" size={20} color={strategyColor} />
                            <Text style={styles.infoText}>
                                Strategy Optimized: Strike selected based on target expiration horizon and risk settings.
                            </Text>
                        </View>

                        {/* Primary Action Button */}
                        <Pressable
                            style={[
                                styles.tradeButton,
                                { backgroundColor: strategyColor },
                                executing && styles.tradeButtonDisabled
                            ]}
                            onPress={handleExecute}
                            disabled={executing}
                        >
                            {executing ? (
                                <Text style={styles.tradeButtonText}>Connecting to Broker...</Text>
                            ) : (
                                <>
                                    <Text style={styles.tradeButtonText}>Execute paper trade</Text>
                                    <Ionicons name="flash" size={20} color="white" />
                                </>
                            )}
                        </Pressable>

                        {/* <Text style={styles.disclaimer}>
                            Always verify contract liquidity and limit prices on your broker workstation before execution.
                        </Text> */}
                    </ScrollView>
                </GlassCard>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: Theme.borderRadius.xxl,
        borderTopRightRadius: Theme.borderRadius.xxl,
        maxHeight: '85%',
        paddingBottom: 40,
    },
    containerContent: {
        padding: 0,
        paddingBottom: 40,
    },
    header: {
        ...layout.flexRow('space-between', 'center'),
        padding: Theme.spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    headerTitleRow: {
        ...layout.flexRow('flex-start', 'center', Theme.spacing.md),
    },
    headerTitle: {
        ...typography('lg', 'bold'),
        color: Theme.colors.text,
    },
    headerSubtitle: {
        ...typography('sm', 'regular'),
        color: Theme.colors.textMuted,
        marginTop: 4,
    },
    closeButton: {
        backgroundColor: Theme.colors.glass,
        padding: 8,
        borderRadius: 20,
    },
    scrollContent: {
        padding: Theme.spacing.xl,
    },
    statsRow: {
        ...layout.flexRow('space-between', 'center'),
        marginBottom: Theme.spacing.xl,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
        marginBottom: 4,
    },
    statValue: {
        ...typography('lg', 'bold'),
        color: Theme.colors.text,
    },
    tradeButton: {
        backgroundColor: Theme.colors.primary,
        flexDirection: 'row',
        height: 56,
        borderRadius: Theme.borderRadius.xl,
        ...layout.center,
        gap: Theme.spacing.sm,
        ...Theme.shadow,
    },
    tradeButtonDisabled: {
        opacity: 0.7,
    },
    tradeButtonText: {
        ...typography('base', 'bold'),
        color: 'white',
    },
    disclaimer: {
        ...typography('xxs', 'regular'),
        color: Theme.colors.textMuted,
        textAlign: 'center',
        marginTop: Theme.spacing.lg,
    },
    infoCard: {
        ...layout.flexRow('flex-start', 'center', Theme.spacing.sm),
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        marginBottom: Theme.spacing.xl,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    infoText: {
        flex: 1,
        ...typography('xs', 'regular'),
        color: Theme.colors.text,
        lineHeight: 18,
    },
    deltaCard: {
        marginBottom: Theme.layout.elementGap,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    deltaHeader: {
        ...layout.flexRow('space-between', 'center'),
        marginBottom: Theme.spacing.sm,
    },
    deltaLabel: {
        ...typography('xs', 'semibold'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    deltaPill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
    },
    deltaPillText: {
        ...typography('xxs', 'bold'),
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    deltaValue: {
        ...typography('lg', 'bold'),
        color: Theme.colors.text,
    },
    deltaMeta: {
        ...typography('xxs', 'regular'),
        color: Theme.colors.textMuted,
        marginTop: Theme.spacing.xs,
    },
    rollCard: {
        marginBottom: Theme.spacing.lg,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    rollTitle: {
        ...typography('xs', 'semibold'),
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Theme.spacing.sm,
    },
    rollGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Theme.spacing.md_inner,
    },
    rollStat: {
        width: '48%',
        marginBottom: Theme.spacing.sm,
    },
    rollLabel: {
        ...typography('xxs', 'regular'),
        color: Theme.colors.textMuted,
        marginBottom: 2,
    },
    rollValue: {
        ...typography('sm', 'bold'),
        color: Theme.colors.text,
    },
    textSuccess: {
        color: Theme.colors.success,
    },
    textDanger: {
        color: Theme.colors.error,
    }
});
