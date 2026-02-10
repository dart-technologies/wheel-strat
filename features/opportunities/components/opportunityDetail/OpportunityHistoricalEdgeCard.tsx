import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import GlassCard from "@/components/GlassCard";
import { Theme } from "@/constants/theme";
import type { Opportunity } from "@wheel-strat/shared";
import { styles } from "./styles";

type OpportunityHistoricalEdgeCardProps = {
    context?: Opportunity['context'] | null;
};

export default function OpportunityHistoricalEdgeCard({ context }: OpportunityHistoricalEdgeCardProps) {
    if (!context) return null;

    return (
        <GlassCard style={styles.sectionCard} blurIntensity={Theme.blur.subtle}>
            <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Theme.colors.success} />
                <Text style={styles.sectionTitle}>Historical Edge</Text>
            </View>
            <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>WIN RATE</Text>
                    <Text style={[styles.statValue, { color: Theme.colors.success }]}>
                        {context.historicalWinRate ? `${(context.historicalWinRate * 100).toFixed(0)}%` : "--"}
                    </Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>THETA GRADE</Text>
                    <Text
                        style={[
                            styles.statValue,
                            {
                                color: context.ivRankGrade === "A" || context.ivRankGrade === "B"
                                    ? Theme.colors.success
                                    : Theme.colors.text,
                            }
                        ]}
                    >
                        {context.ivRankGrade || "--"}
                    </Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>MATCHES</Text>
                    <Text style={styles.statValue}>{context.historicalMatches || 0}</Text>
                </View>
            </View>
        </GlassCard>
    );
}
