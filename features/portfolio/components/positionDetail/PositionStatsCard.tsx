import { Text, View } from 'react-native';
import GlassCard from '@/components/GlassCard';
import { Theme } from '@/constants/theme';
import { styles } from './styles';

type PositionStatsCardProps = {
    marketValue: number;
    totalReturn: number;
    totalReturnPct: number;
    quantity: number;
    avgCost: number;
    currentPrice: number;
};

export function PositionStatsCard({
    marketValue,
    totalReturn,
    totalReturnPct,
    quantity,
    avgCost,
    currentPrice
}: PositionStatsCardProps) {
    return (
        <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.statRow}>
                <View>
                    <Text style={styles.label}>Market Value</Text>
                    <Text style={styles.bigValue}>${marketValue.toLocaleString()}</Text>
                </View>
                <View style={styles.badgeContainer}>
                    <View style={[styles.badge, totalReturn >= 0 ? styles.badgeSuccess : styles.badgeError]}>
                        <Text style={[styles.badgeText, totalReturn >= 0 ? styles.textSuccess : styles.textError]}>
                            {totalReturn >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.grid}>
                <View>
                    <Text style={styles.label}>Shares</Text>
                    <Text style={styles.value}>{quantity}</Text>
                </View>
                <View>
                    <Text style={styles.label}>Avg Cost</Text>
                    <Text style={styles.value}>${avgCost.toFixed(2)}</Text>
                </View>
                <View>
                    <Text style={styles.label}>Current</Text>
                    <Text style={styles.value}>${currentPrice.toFixed(2)}</Text>
                </View>
                <View>
                    <Text style={styles.label}>Return</Text>
                    <Text style={[styles.value, totalReturn >= 0 ? styles.textSuccess : styles.textError]}>
                        {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                </View>
            </View>
        </GlassCard>
    );
}
