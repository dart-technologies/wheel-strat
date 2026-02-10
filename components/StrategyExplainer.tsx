import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import HistoricalChart from './HistoricalChart';
import PayoffChart from './PayoffChart';
import { formatTimeSince } from '../utils/time';
import { explainTrade } from '../services/api';
import GlassCard from './GlassCard';
import { useTraderLevel } from '../features/settings/hooks';
import PayoffGlyph from './PayoffGlyph';
import TradeMetaRow from './TradeMetaRow';

import { Skeleton } from './Skeleton';

// Load historical data (mock/local source)
// In a real app, this might be fetched from an API or Context
import historicalDataJson from '../assets/data/mag7_historical_1y.json';

const HISTORICAL_DATA: Record<string, { bars: any[] }> = historicalDataJson;

interface StrategyExplainerProps {
    isVisible: boolean;
    onClose: () => void;
    tradeContext?: {
        symbol: string;
        strategy: string;
        strike: number;
        expiration: string;
        premium: number;
    };
}

export default function StrategyExplainer({ isVisible, onClose, tradeContext }: StrategyExplainerProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [isCached, setIsCached] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { currentTraderLevel } = useTraderLevel();

    const fetchExplanation = useCallback(async (forceRefresh = false) => {
        if (!tradeContext) return;

        try {
            if (forceRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const result = await explainTrade({
                symbol: tradeContext.symbol,
                strategy: tradeContext.strategy,
                strike: tradeContext.strike,
                expiration: tradeContext.expiration,
                premium: tradeContext.premium,
                traderLevel: currentTraderLevel,
                now: new Date().toISOString(),
                forceRefresh
            });

            if (result.error) {
                console.error('Error fetching explanation:', result.error);
                setError('Failed to generate explanation. Please try again.');
                return;
            }

            const data = result.data;
            setExplanation(data.explanation);
            setGeneratedAt(data.generatedAt ? new Date(data.generatedAt) : null);
            setIsCached(Boolean(data.cached));

        } catch (err) {
            console.error('Error fetching explanation:', err);
            setError('Failed to generate explanation. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [tradeContext, currentTraderLevel]);

    useEffect(() => {
        if (isVisible && tradeContext) {
            fetchExplanation();
        }
    }, [isVisible, tradeContext, fetchExplanation]);

    const resolvedTrade = tradeContext ?? {
        symbol: '',
        strategy: '',
        strike: 0,
        expiration: '',
        premium: 0
    };
    const maxProfit = (resolvedTrade.premium * 100).toFixed(0);
    const collateral = (resolvedTrade.strike * 100).toLocaleString();
    const isCoveredCall = resolvedTrade.strategy.toLowerCase().includes('call');
    const strategyColor = isCoveredCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;
    const spotPrice = useMemo(() => {
        if (!resolvedTrade.symbol) return resolvedTrade.strike;
        const series = HISTORICAL_DATA[resolvedTrade.symbol]?.bars;
        const last = Array.isArray(series) ? series[series.length - 1] : null;
        const close = Number(last?.close);
        return Number.isFinite(close) ? close : resolvedTrade.strike;
    }, [resolvedTrade.symbol, resolvedTrade.strike]);
    const payoffData = useMemo(() => {
        if (!tradeContext) return [];
        const steps = 40;
        const spot = Number.isFinite(spotPrice) && spotPrice > 0 ? spotPrice : resolvedTrade.strike;
        const lower = spot * 0.7;
        const upper = spot * 1.3;
        const points = [];
        for (let i = 0; i <= steps; i += 1) {
            const price = lower + ((upper - lower) * i) / steps;
            let pnl = 0;
            if (isCoveredCall) {
                pnl = resolvedTrade.premium + (price - spot) - Math.max(0, price - resolvedTrade.strike);
            } else {
                pnl = resolvedTrade.premium - Math.max(0, resolvedTrade.strike - price);
            }
            points.push({ price, pnl: pnl * 100 });
        }
        return points;
    }, [tradeContext, resolvedTrade.premium, resolvedTrade.strike, isCoveredCall, spotPrice]);

    if (!isVisible || !tradeContext) return null;

    return (
        <Modal animationType="slide" transparent visible={isVisible}>
            <View style={styles.container}>
                <BlurView intensity={Theme.blur.strong} style={StyleSheet.absoluteFill} tint="dark" />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Strategy Breakdown</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={Theme.colors.text} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Trade Summary */}
                    <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                        <Text style={styles.cardTitle}>The Trade</Text>
                        <View style={styles.tradeSummary}>
                            <Text style={styles.symbol}>{tradeContext.symbol}</Text>
                            <View style={styles.strategyRow}>
                                <PayoffGlyph type={isCoveredCall ? 'cc' : 'csp'} color={strategyColor} />
                                <TradeMetaRow
                                    strategy={tradeContext.strategy}
                                    expiration={tradeContext.expiration}
                                    strike={tradeContext.strike}
                                    strategyColor={strategyColor}
                                    containerStyle={styles.tradeMetaRow}
                                />
                            </View>
                        </View>
                        <View style={styles.detailsRow}>
                            <View style={styles.detailItem}>
                                <Text style={styles.label}>Premium</Text>
                                <Text style={[styles.value, styles.premiumValue]}>${tradeContext.premium}</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.label}>Max Profit</Text>
                                <Text style={styles.value}>${maxProfit}</Text>
                            </View>
                            <View style={[styles.detailItem, styles.detailItemFull]}>
                                <Text style={styles.label}>Collateral</Text>
                                <Text style={styles.value}>${collateral}</Text>
                            </View>
                        </View>
                    </GlassCard>

                    {/* Historical Chart */}
                    {tradeContext && HISTORICAL_DATA[tradeContext.symbol] && (
                        <HistoricalChart
                            data={HISTORICAL_DATA[tradeContext.symbol].bars}
                            symbol={tradeContext.symbol}
                            dataTier="derived"
                            dataTierLabel="Historical"
                        />
                    )}

                    <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                        <Text style={styles.cardTitle}>Payoff Curve</Text>
                        <PayoffChart data={payoffData} height={180} />
                        <Text style={styles.payoffNote}>Based on spot ${spotPrice.toFixed(2)}.</Text>
                    </GlassCard>

                    {/* How It Works */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>How It Works</Text>
                        {isCoveredCall ? (
                            <>
                                <View style={styles.step}>
                                    <Ionicons name="gift-outline" size={24} color={Theme.colors.success} />
                                    <Text style={styles.stepText}>
                                        You collect <Text style={styles.highlightSuccess}>${maxProfit}</Text> in premium immediately by selling the call option.
                                    </Text>
                                </View>
                                <View style={styles.step}>
                                    <Ionicons name="shield-checkmark-outline" size={24} color={Theme.colors.primary} />
                                    <Text style={styles.stepText}>
                                        You agree to sell your 100 {tradeContext.symbol} shares at <Text style={styles.highlightPrimary}>${tradeContext.strike}</Text> if the stock rises above that price.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.step}>
                                    <Ionicons name="gift-outline" size={24} color={Theme.colors.success} />
                                    <Text style={styles.stepText}>
                                        You collect <Text style={styles.highlightSuccess}>${maxProfit}</Text> in premium immediately. This is yours to keep no matter what.
                                    </Text>
                                </View>
                                <View style={styles.step}>
                                    <Ionicons name="shield-checkmark-outline" size={24} color={Theme.colors.primary} />
                                    <Text style={styles.stepText}>
                                        You agree to buy 100 {tradeContext.symbol} shares if they drop below <Text style={styles.highlightPrimary}>${tradeContext.strike}</Text> by expiration.
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    {/* AI Reasoning */}
                    <GlassCard style={styles.aiCard} contentStyle={styles.aiContent} blurIntensity={Theme.blur.medium} tint="dark">
                        <View style={styles.aiHeader}>
                            <View style={styles.aiTitleRow}>
                                <Ionicons name="sparkles" size={20} color={Theme.colors.white} />
                                <Text style={styles.aiTitle}>Gemini Analysis</Text>
                            </View>
                            <View style={styles.aiMeta}>
                                {generatedAt && (
                                    <Text style={styles.aiTimestamp}>
                                        {isCached ? '📦 ' : ''}{formatTimeSince(generatedAt)}
                                    </Text>
                                )}
                                <Pressable
                                    onPress={() => fetchExplanation(true)}
                                    disabled={refreshing}
                                    style={styles.refreshButton}
                                >
                                    {refreshing ? (
                                        <ActivityIndicator size="small" color={Theme.colors.white} />
                                    ) : (
                                        <Ionicons name="refresh" size={18} color={Theme.colors.white} />
                                    )}
                                </Pressable>
                            </View>
                        </View>

                        {loading ? (
                            <View style={{ gap: Theme.spacing.sm, paddingVertical: Theme.spacing.sm }}>
                                <Skeleton width="40%" height={16} style={{ backgroundColor: Theme.colors.skeletonStrong }} />
                                <Skeleton width="100%" height={14} style={{ backgroundColor: Theme.colors.skeletonSoft }} />
                                <Skeleton width="90%" height={14} style={{ backgroundColor: Theme.colors.skeletonSoft }} />
                                <Skeleton width="95%" height={14} style={{ backgroundColor: Theme.colors.skeletonSoft }} />
                            </View>
                        ) : error ? (
                            <Text style={styles.aiError}>{error}</Text>
                        ) : (
                            <Text style={styles.aiText}>{explanation}</Text>
                        )}
                    </GlassCard>

                    <View style={styles.spacer} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: Theme.spacing.xxxl_plus,
        backgroundColor: Theme.colors.surface,
        borderTopLeftRadius: Theme.borderRadius.xxl,
        borderTopRightRadius: Theme.borderRadius.xxl,
        overflow: 'hidden',
    },
    header: {
        padding: Theme.spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
        zIndex: 10,
        backgroundColor: Theme.colors.surface,
    },
    headerTitle: {
        fontSize: Theme.typography.sizes.xl,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    closeButton: {
        padding: Theme.spacing.xs,
        backgroundColor: Theme.colors.glass,
        borderRadius: Theme.borderRadius.full,
    },
    scrollContent: {
        padding: Theme.spacing.md,
    },
    card: {
        marginBottom: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.xl,
    },
    cardContent: {
        padding: Theme.spacing.md,
    },
    cardTitle: {
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.sm,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: '600',
    },
    payoffNote: {
        marginTop: Theme.spacing.sm,
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    tradeSummary: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.lg,
        flexWrap: 'wrap',
    },
    strategyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        flexWrap: 'wrap',
    },
    symbol: {
        fontSize: Theme.typography.sizes.display,
        fontWeight: 'bold',
        color: Theme.colors.text,
        flexShrink: 1,
    },
    tradeMetaRow: {
        flexShrink: 1,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        columnGap: Theme.spacing.xl,
        rowGap: Theme.spacing.sm,
    },
    detailItem: {
        flexBasis: '48%',
        minWidth: 120,
    },
    detailItemFull: {
        flexBasis: '100%',
    },
    label: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    value: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    premiumValue: {
        color: Theme.colors.success,
    },
    section: {
        marginBottom: Theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.md,
    },
    step: {
        flexDirection: 'row',
        gap: Theme.spacing.md,
        alignItems: 'flex-start',
        marginBottom: Theme.spacing.md,
    },
    stepText: {
        color: Theme.colors.text,
        flex: 1,
        lineHeight: 22,
    },
    highlightSuccess: {
        color: Theme.colors.success,
        fontWeight: 'bold',
    },
    highlightPrimary: {
        color: Theme.colors.primary,
        fontWeight: 'bold',
    },
    scenarioCard: {
        borderRadius: Theme.borderRadius.lg,
        marginBottom: Theme.spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: Theme.colors.success,
    },
    scenarioContent: {
        padding: Theme.spacing.md,
    },
    cardAssigned: {
        borderLeftColor: Theme.colors.primary,
    },
    scenarioTitle: {
        fontWeight: 'bold',
        color: Theme.colors.text,
        marginBottom: Theme.spacing.xs,
    },
    scenarioText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        lineHeight: 20,
        marginBottom: Theme.spacing.sm,
    },
    outcomeText: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: 'bold',
    },
    textSuccess: {
        color: Theme.colors.success,
    },
    textPrimary: {
        color: Theme.colors.primary,
    },
    aiCard: {
        backgroundColor: Theme.colors.primary,
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.xl,
    },
    aiContent: {
        padding: Theme.spacing.md,
    },
    aiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    aiTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    aiTitle: {
        color: Theme.colors.white,
        fontWeight: 'bold',
    },
    aiMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    aiTimestamp: {
        color: Theme.colors.white,
        opacity: 0.8,
        fontSize: Theme.typography.sizes.xs,
    },
    refreshButton: {
        padding: Theme.spacing.xs,
    },
    aiLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        paddingVertical: Theme.spacing.md,
    },
    aiLoadingText: {
        color: Theme.colors.white,
        opacity: 0.9,
    },
    aiError: {
        color: Theme.colors.white,
        opacity: 0.9,
    },
    aiText: {
        color: Theme.colors.white,
        lineHeight: 22,
        opacity: 0.9,
    },
    spacer: {
        height: Theme.spacing.xl,
    }
});
