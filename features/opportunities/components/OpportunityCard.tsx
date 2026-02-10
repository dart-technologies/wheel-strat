import React, { useMemo, memo } from 'react';
import { StyleSheet, Text, Pressable, View, ActivityIndicator } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import { Analytics } from '@/services/analytics';
import { OpportunityAnalysis, OpportunityContext } from '@wheel-strat/shared';
import { useAuth } from '@/hooks/useAuth';
import { useDteWindow, useRiskProfile } from '@/features/settings/hooks';
import GlassCard from '@/components/GlassCard';
import OpportunityHeader from './opportunity/Header';
import AnalystOutlook from './opportunity/AnalystOutlook';
import TechnicalLevels from './opportunity/TechnicalLevels';
import { getDteWindowRange } from '@/utils/settings';
import { formatCurrency, formatPercent } from '@/utils/format';
import { getDaysToExpiration } from '@/utils/time';
import { useExecuteOpportunity } from '@/hooks/useExecuteOpportunity';

export interface OpportunityCardProps {
    symbol: string;
    strategy: string; // "Covered Call" or "Cash-Secured Put"
    strike?: number;
    expiration?: string;
    premium?: number;
    winProb?: number; // 0-100
    annualizedYield?: number;
    explanation: string;
    priority?: number; // 1, 2, or 3
    onExplain?: () => void;
    analysis?: OpportunityAnalysis;
    context?: OpportunityContext;
    index?: number;
}

const OpportunityCard = memo(({
    symbol,
    strategy,
    strike,
    expiration,
    premium,
    winProb,
    annualizedYield,
    explanation,
    priority,
    onExplain,
    analysis,
    context,
    index = 0
}: OpportunityCardProps) => {
    const { isAuthenticated } = useAuth();
    const { currentRisk } = useRiskProfile();
    const { currentDteWindow } = useDteWindow();
    const isCoveredCall = strategy === "Covered Call";
    const accentColor = isCoveredCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;
    const hasAnalysis = Boolean(analysis && (analysis.scenarios || analysis.technicals || analysis.verdict));
    const { executeOpportunity, executing } = useExecuteOpportunity();

    const dte = useMemo(() => getDaysToExpiration(expiration), [expiration]);
    const dteRange = useMemo(() => getDteWindowRange(currentDteWindow), [currentDteWindow]);
    const dteMatch = dte !== null && dte >= dteRange.minDays && dte <= dteRange.maxDays;
    const autoReady = Boolean(dteMatch && typeof winProb === 'number' && winProb >= 70);

    const dteLabel = dte !== null ? `${dte}d` : '--';
    const yieldLabel = typeof annualizedYield === 'number' ? formatPercent(annualizedYield, 1) : '--';
    const winProbLabel = typeof winProb === 'number' ? formatPercent(winProb, 0) : '--';
    const premiumLabel = typeof premium === 'number' ? formatCurrency(premium) : '--';

    const catalysts = analysis?.catalysts;
    const catalystText = Array.isArray(catalysts)
        ? catalysts[0]?.event
            ? `${catalysts[0]?.event}${catalysts[0]?.date ? ` • ${catalysts[0]?.date}` : ''}`
            : undefined
        : catalysts?.earnings
            ? `Earnings: ${catalysts.earnings}`
            : catalysts?.events?.length
                ? `Events: ${catalysts.events.slice(0, 2).join(', ')}`
                : undefined;
    const verdictCopy = analysis?.verdict ? `"${analysis.verdict}"` : 'No verdict yet.';

    const handleExplain = () => {
        if (onExplain) {
            Haptics.selectionAsync();
            Analytics.logStrategyExplanation(symbol, strategy);
            onExplain();
        }
    };

    const handleExecute = () => {
        executeOpportunity({
            symbol,
            strategy,
            strike: strike ?? 0,
            expiration: expiration ?? '',
            premium: typeof premium === 'number' ? premium : undefined
        }, {
            source: 'Agent Execution'
        });
    };

    const enterTransition = FadeIn
        .duration(Theme.motion.duration.slow)
        .delay(index * 50) // Staggered entry
        .easing(Easing.out(Easing.cubic));
    const exitTransition = FadeOut.duration(Theme.motion.duration.slow).easing(Easing.out(Easing.cubic));
    const layoutTransition = LinearTransition.duration(Theme.motion.duration.slow)
        .easing(Easing.out(Easing.cubic));

    return (
        <Animated.View
            entering={enterTransition}
            exiting={exitTransition}
            layout={layoutTransition}
            testID="opportunity-card"
        >
            <GlassCard style={[styles.card, { borderLeftColor: accentColor }]} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

                <OpportunityHeader
                    symbol={symbol}
                    strategy={strategy}
                    strike={strike}
                    priority={priority}
                    accentColor={accentColor}
                />

                <View style={styles.statusRow}>
                    <View style={[styles.statusChip, dteMatch ? styles.statusChipActive : styles.statusChipMuted]}>
                        <Text style={styles.statusChipText}>Target {dteRange.label}</Text>
                    </View>
                    <View style={styles.statusChipMuted}>
                        <Text style={styles.statusChipText}>Risk {currentRisk}</Text>
                    </View>
                    <View style={[styles.statusChip, autoReady ? styles.statusChipReady : styles.statusChipReview]}>
                        <Text style={styles.statusChipText}>{autoReady ? 'Auto-ready' : 'Review'}</Text>
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={styles.metricTile}>
                        <Text style={styles.metricLabel}>Yield</Text>
                        <Text style={[styles.metricValue, styles.metricHighlight]}>{yieldLabel}</Text>
                    </View>
                    <View style={styles.metricTile}>
                        <Text style={styles.metricLabel}>Win Prob</Text>
                        <Text style={styles.metricValue}>{winProbLabel}</Text>
                    </View>
                    <View style={styles.metricTile}>
                        <Text style={styles.metricLabel}>DTE</Text>
                        <Text style={styles.metricValue}>{dteLabel}</Text>
                    </View>
                    <View style={styles.metricTile}>
                        <Text style={styles.metricLabel}>Premium</Text>
                        <Text style={styles.metricValue}>{premiumLabel}</Text>
                    </View>
                </View>

                {/* Contextual Intelligence Badge */}
                {context && (
                    <View style={styles.contextContainer}>
                        <Text style={styles.contextLabel}>HISTORICAL EDGE</Text>
                        <View style={styles.contextRow}>
                            <View style={styles.contextItem}>
                                <Text style={styles.contextValue}>
                                    {context.historicalWinRate ? `${(context.historicalWinRate * 100).toFixed(0)}%` : '--'}
                                </Text>
                                <Text style={styles.contextMeta}>Win Rate</Text>
                            </View>
                            <View style={[styles.divider]} />
                            <View style={styles.contextItem}>
                                <Text style={[styles.contextValue, {
                                    color: context.ivRankGrade === 'A' || context.ivRankGrade === 'B' ? Theme.colors.success : Theme.colors.text
                                }]}>
                                    {context.ivRankGrade || '--'}
                                </Text>
                                <Text style={context.ivRankGrade === 'A' || context.ivRankGrade === 'B' ? styles.contextMetaSuccess : styles.contextMeta}>Theta Grade</Text>
                            </View>
                            <View style={[styles.divider]} />
                            <View style={styles.contextItem}>
                                <Text style={styles.contextValue}>{context.historicalMatches || 0}</Text>
                                <Text style={styles.contextMeta}>Matches</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Rich Analysis Visualization */}
                {hasAnalysis ? (
                    <View style={styles.analysisContainer}>
                        <AnalystOutlook scenarios={analysis?.scenarios} />

                        <TechnicalLevels
                            symbol={symbol}
                            strike={strike}
                            currentPrice={analysis?.currentPrice}
                            technicals={analysis?.technicals}
                            metrics={analysis?.metrics}
                        />

                        {/* Catalyst */}
                        {catalystText && (
                            <View style={styles.catalystContainer}>
                                <Text style={styles.catalystText}>
                                    📅 <Text style={{ color: Theme.colors.text }}>{catalystText}</Text>
                                </Text>
                            </View>
                        )}

                        {/* Verdict */}
                        <Text style={styles.verdictText}>{verdictCopy}</Text>
                    </View>
                ) : (
                    /* Fallback to simple explanation */
                    <Text style={styles.explanation} numberOfLines={3}>
                        {explanation || "No analysis available yet."}
                    </Text>
                )}

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                    {onExplain && (
                        <Pressable
                            onPress={handleExplain}
                            style={[styles.button, styles.explainButton]}
                            testID="explain-button"
                        >
                            <Text style={[styles.buttonText, { color: Theme.colors.text }]}>
                                ✨ Explain
                            </Text>
                        </Pressable>
                    )}

                    <Pressable
                        onPress={handleExecute}
                        disabled={executing}
                        style={[
                            styles.button,
                            styles.executeButton,
                            { backgroundColor: isAuthenticated ? accentColor : Theme.colors.glassBorder }
                        ]}
                        testID="execute-button"
                    >
                        {executing ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text style={[styles.buttonText, { color: isAuthenticated ? 'white' : Theme.colors.textMuted }]}>
                                {isAuthenticated ? 'Execute Trade' : 'Sign in to Execute'}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </GlassCard>
        </Animated.View>
    );
});

export default OpportunityCard;

const styles = StyleSheet.create({
    card: {
        borderRadius: Theme.borderRadius.xl,
        borderLeftWidth: 4,
        marginBottom: Theme.spacing.md,
    },
    cardContent: {
        padding: Theme.layout.cardPadding,
        position: 'relative',
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: Theme.spacing.lg,
        bottom: Theme.spacing.lg,
        width: 3,
        borderRadius: 2,
        opacity: Theme.opacity.visible + 0.1, // 0.9
    },
    statusRow: {
        ...layout.flexRow('flex-start', 'center', Theme.spacing.sm),
        flexWrap: 'wrap',
        marginBottom: Theme.spacing.md,
    },
    statusChip: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
    },
    statusChipMuted: {
        backgroundColor: Theme.colors.glassSubtle,
        borderColor: Theme.colors.glassBorder,
    },
    statusChipActive: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    statusChipReady: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    statusChipReview: {
        backgroundColor: Theme.colors.warningWash,
        borderColor: Theme.colors.warning,
    },
    statusChipText: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.text,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
    },
    metricTile: {
        flexBasis: '48%',
        minWidth: 140,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    metricLabel: {
        ...typography('xxs', 'bold'),
        color: Theme.colors.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    metricValue: {
        ...typography('sm', 'bold'),
        color: Theme.colors.text,
    },
    metricHighlight: {
        color: Theme.colors.success,
    },
    contextContainer: {
        backgroundColor: Theme.colors.backgroundAccent,
        borderRadius: Theme.borderRadius.sm,
        padding: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    contextLabel: {
        ...typography('xs', 'bold'),
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.xs,
        letterSpacing: 1,
    },
    contextRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    contextItem: {
        alignItems: 'center',
    },
    contextValue: {
        ...typography('md', 'bold'),
        color: Theme.colors.text,
    },
    contextMeta: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    contextMetaSuccess: {
        ...typography('xs', 'regular'),
        color: Theme.colors.success,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: Theme.colors.glassBorder,
    },
    explanation: {
        ...typography('sm', 'regular'),
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.md,
    },
    analysisContainer: {
        marginBottom: Theme.spacing.md,
        backgroundColor: Theme.colors.glassStrong,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    catalystContainer: {
        flexDirection: 'row',
        marginBottom: Theme.spacing.sm,
        marginTop: 4,
    },
    catalystText: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
    verdictText: {
        ...typography('sm', 'regular'),
        fontStyle: 'italic',
        color: Theme.colors.text,
        marginTop: Theme.spacing.xs,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: Theme.spacing.md,
    },
    button: {
        ...layout.center,
        flex: 1,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
    },
    explainButton: {
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    executeButton: {
        shadowColor: Theme.colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    buttonText: {
        ...typography('sm', 'bold'),
    },
});
