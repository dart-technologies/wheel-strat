import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import GlassCard from "@/components/GlassCard";
import { Theme } from "@/constants/theme";
import type { BacktestResult, StrategyRecipe } from "@wheel-strat/shared";
import { styles } from "./styles";

type OpportunityAsymmetryCardProps = {
    asymmetry: number | null;
    backtestWinLabel: string;
    backtestLossLabel: string;
    edgeScoreLabel: string;
    doppelgangerSignal: { avg: number; count: number } | null;
    localBacktest: { recipe: StrategyRecipe; result: BacktestResult } | null;
    hasBacktest: boolean;
    chartLabels: string[];
    chartData: { y: number }[];
    chartWidth: number;
    chartConfig: any;
};

export default function OpportunityAsymmetryCard({
    asymmetry,
    backtestWinLabel,
    backtestLossLabel,
    edgeScoreLabel,
    doppelgangerSignal,
    localBacktest,
    hasBacktest,
    chartLabels,
    chartData,
    chartWidth,
    chartConfig
}: OpportunityAsymmetryCardProps) {
    const chartHeight = chartWidth < 360 ? 140 : 160;
    const resolvedChartWidth = Math.max(220, chartWidth - Theme.spacing.md * 2);
    const insightChips = [
        doppelgangerSignal
            ? `Pattern ${((doppelgangerSignal.avg || 0) * 100).toFixed(1)}% · ${doppelgangerSignal.count}x`
            : null,
        localBacktest && !hasBacktest
            ? `Playbook: ${localBacktest.recipe.name}`
            : null
    ].filter(Boolean) as string[];

    const stats = [
        { label: "Asymmetry", value: Number.isFinite(asymmetry ?? NaN) ? `${(asymmetry as number).toFixed(1)}x` : "--", tone: Theme.colors.text },
        { label: "Win Rate", value: backtestWinLabel, tone: Theme.colors.success },
        { label: "Max Loss", value: backtestLossLabel, tone: Theme.colors.error },
        { label: "Edge", value: edgeScoreLabel, tone: Theme.colors.text },
    ];

    return (
        <GlassCard style={styles.sectionCard} blurIntensity={Theme.blur.medium}>
            <View style={styles.sectionHeader}>
                <Ionicons name="analytics-outline" size={16} color={Theme.colors.warning} />
                <Text style={styles.sectionTitle}>Edge & Backtest</Text>
            </View>
            <View style={styles.asymmetryGrid}>
                {stats.map((stat) => (
                    <View key={stat.label} style={styles.asymmetryTile}>
                        <Text style={styles.asymmetryLabel}>{stat.label}</Text>
                        <Text style={[styles.asymmetryValue, { color: stat.tone }]}>{stat.value}</Text>
                    </View>
                ))}
            </View>
            {insightChips.length > 0 && (
                <View style={styles.insightRow}>
                    {insightChips.map((label) => (
                        <View key={label} style={styles.insightChip}>
                            <Text style={styles.insightText}>{label}</Text>
                        </View>
                    ))}
                </View>
            )}
            <View style={styles.chartContainer}>
                <LineChart
                    data={{
                        labels: chartLabels,
                        datasets: [{ data: chartData.map((point) => point.y) }],
                    }}
                    width={resolvedChartWidth}
                    height={chartHeight}
                    yAxisLabel="$"
                    yAxisSuffix=""
                    chartConfig={chartConfig}
                    bezier
                    style={styles.plChart}
                />
            </View>
        </GlassCard>
    );
}
