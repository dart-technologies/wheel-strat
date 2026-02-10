import { Text, View } from "react-native";
import DataTierBadge from "@/components/DataTierBadge";
import GlassCard from "@/components/GlassCard";
import TradeMetaRow from "@/components/TradeMetaRow";
import { Theme } from "@/constants/theme";
import type { Opportunity } from "@wheel-strat/shared";
import { formatCurrency } from "@/utils/format";
import { styles } from "./styles";

type OpportunityHeroCardProps = {
    opportunity: Opportunity;
    strategyColor: string;
    isStale: boolean;
    freshnessLabel: string;
    annualizedYieldText: string;
    winProbText: string;
    dteLabel: string;
    premiumText: string;
    ivRankText: string;
    impliedVolText: string;
    dteRangeLabel: string;
    currentRisk: string;
    dteMatch: boolean;
    autoReady: boolean;
    isCoveredCall: boolean;
};

export default function OpportunityHeroCard({
    opportunity,
    strategyColor,
    isStale,
    freshnessLabel,
    annualizedYieldText,
    winProbText,
    dteLabel,
    premiumText,
    ivRankText,
    impliedVolText,
    dteRangeLabel,
    currentRisk,
    dteMatch,
    autoReady,
    isCoveredCall
}: OpportunityHeroCardProps) {
    const resolvedPrice = typeof opportunity.currentPrice === 'number' && Number.isFinite(opportunity.currentPrice)
        ? opportunity.currentPrice
        : (typeof opportunity.analysis?.currentPrice === 'number' && Number.isFinite(opportunity.analysis?.currentPrice)
            ? opportunity.analysis.currentPrice
            : undefined);
    const priceText = typeof resolvedPrice === 'number'
        ? formatCurrency(resolvedPrice)
        : '--';

    const metrics = [
        { key: 'spot', label: 'Spot', value: priceText },
        { key: 'premium', label: 'Premium', value: premiumText },
        { key: 'winProb', label: 'Win Prob', value: winProbText },
        { key: 'dte', label: 'DTE', value: dteLabel },
        { key: 'ivRank', label: 'IV Rank', value: ivRankText, hideIfMissing: true },
        { key: 'implVol', label: 'Impl. Vol', value: impliedVolText, hideIfMissing: true },
    ];
    const visibleMetrics = metrics.filter((metric) => metric.value !== '--' || !metric.hideIfMissing);

    return (
        <GlassCard
            style={styles.heroCard}
            contentStyle={styles.heroContent}
            blurIntensity={Theme.blur.medium}
            isStale={isStale}
        >
            <View style={styles.heroTop}>
                <View style={styles.heroLeft}>
                    <Text style={styles.symbol}>{opportunity.symbol}</Text>
                    <TradeMetaRow
                        strategy={opportunity.strategy}
                        expiration={opportunity.expiration}
                        strike={opportunity.strike}
                        strategyColor={strategyColor}
                    />
                </View>
                <View style={styles.heroRight}>
                    <Text style={[styles.yieldValue, Theme.typography.numeric]}>{annualizedYieldText}</Text>
                    <Text style={styles.yieldLabel}>Annualized</Text>
                    <View style={styles.dataRow}>
                        <DataTierBadge tier={isStale ? "stale" : "live"} />
                        <Text style={styles.dataAge}>{freshnessLabel}</Text>
                    </View>
                </View>
            </View>

            {visibleMetrics.length > 0 ? (
                <View style={styles.metricTable}>
                    {visibleMetrics.map((metric) => (
                        <View key={metric.key} style={styles.metricRow}>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                            <Text style={[styles.metricValue, Theme.typography.numeric]}>{metric.value}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={styles.metricEmptyText}>Waiting for live option quotes.</Text>
            )}

            {/* <View style={styles.fitRow}>
                <View style={[styles.fitChip, dteMatch ? styles.fitChipActive : styles.fitChipMuted]}>
                    <Text style={styles.fitText}>Target {dteRangeLabel}</Text>
                </View>
                <View style={styles.fitChipMuted}>
                    <Text style={styles.fitText}>Risk {currentRisk}</Text>
                </View>
                <View style={[styles.fitChip, autoReady ? styles.autoChipReady : styles.autoChipReview]}>
                    <Text style={styles.fitText}>{autoReady ? "Auto-ready" : "Review"}</Text>
                </View>
            </View> */}

            {/* <View style={styles.cycleRow}>
                <View style={[styles.cycleChip, !isCoveredCall ? styles.cycleChipActive : styles.cycleChipMuted]}>
                    <Text style={styles.cycleText}>Acquire</Text>
                </View>
                <View style={[styles.cycleChip, isCoveredCall ? styles.cycleChipActive : styles.cycleChipMuted]}>
                    <Text style={styles.cycleText}>Hold / Harvest</Text>
                </View>
                <View style={styles.cycleChipMuted}>
                    <Text style={styles.cycleText}>Accumulate</Text>
                </View>
            </View> */}
        </GlassCard>
    );
}
