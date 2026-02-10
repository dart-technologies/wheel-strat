import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import GlassCard from "@/components/GlassCard";
import HistoricalChart from "@/components/HistoricalChart";
import { Theme } from "@/constants/theme";
import TechnicalLevels from "@/features/opportunities/components/opportunity/TechnicalLevels";
import { styles } from "./styles";

type OpportunityTechnicalCardProps = {
    symbol: string;
    hasHistorical: boolean;
    historicalBars: { date: string; close: number; volume: number }[];
    support?: number;
    resistance?: number;
    impliedVol?: number;
    patternLabel?: string | null;
    accentColor?: string;
    chartEvents: { date: string; label?: string; impact?: string }[];
    strike?: number;
    currentPrice?: number;
    technicals?: any;
    metrics?: any;
};

export default function OpportunityTechnicalCard({
    symbol,
    hasHistorical,
    historicalBars,
    support,
    resistance,
    impliedVol,
    patternLabel,
    accentColor,
    chartEvents,
    strike,
    currentPrice,
    technicals,
    metrics
}: OpportunityTechnicalCardProps) {
    return (
        <GlassCard
            style={[styles.sectionCard, styles.performanceCard]}
            contentStyle={styles.performanceContent}
            blurIntensity={Theme.blur.medium}
        >
            <View style={styles.sectionHeader}>
                <Ionicons name="pulse-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.sectionTitle}>Performance</Text>
                {patternLabel ? (
                    <View style={styles.patternChip}>
                        <Text style={styles.patternText} numberOfLines={2} ellipsizeMode="tail">{patternLabel}</Text>
                    </View>
                ) : null}
            </View>
            {hasHistorical ? (
                <HistoricalChart
                    data={historicalBars}
                    symbol={symbol}
                    height={280}
                    support={support}
                    resistance={resistance}
                    showHeader={false}
                    spotPrice={currentPrice}
                    strikePrice={strike}
                    impliedVol={impliedVol}
                    events={chartEvents}
                    showVolumeProfile
                    accentColor={accentColor}
                    useContainer={false}
                    compact
                />
            ) : (
                <View style={styles.chartFallback}>
                    <Text style={styles.bodyText}>Historical series available for Mag7 symbols.</Text>
                </View>
            )}
            <TechnicalLevels
                symbol={symbol}
                strike={strike}
                currentPrice={currentPrice}
                technicals={technicals}
                metrics={metrics}
                supportOverride={support}
                resistanceOverride={resistance}
                patternOverride={patternLabel ?? null}
            />
        </GlassCard>
    );
}
