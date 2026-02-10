import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SegmentedControl from '@/components/SegmentedControl';
import HistoricalChart from '@/components/HistoricalChart';
import GlassCard from '@/components/GlassCard';
import { Theme } from '@/constants/theme';
import { styles } from './styles';

type PerformanceChartSectionProps = {
    rangeOptions: Array<'1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX'>;
    rangeIndex: number;
    onRangeChange: (index: number) => void;
    chartBars: any[];
    symbol?: string;
    avgCost: number;
    historicalLoading: boolean;
    historicalTierLabel: string;
    support?: number;
    resistance?: number;
    events: Array<{ date: string; label: string; impact?: string }>;
};

export function PerformanceChartSection({
    rangeOptions,
    rangeIndex,
    onRangeChange,
    chartBars,
    symbol,
    avgCost,
    historicalLoading,
    historicalTierLabel,
    support,
    resistance,
    events
}: PerformanceChartSectionProps) {
    return (
        <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Performance</Text>
            </View>
            <SegmentedControl
                options={rangeOptions}
                selectedIndex={rangeIndex}
                onChange={onRangeChange}
                style={styles.chartControl}
            />
            {chartBars.length > 0 ? (
                <HistoricalChart
                    data={chartBars}
                    symbol={symbol ?? ''}
                    height={240}
                    support={support}
                    resistance={resistance}
                    purchasePrice={avgCost}
                    rangeLabel={rangeOptions[rangeIndex]}
                    dataTier="derived"
                    dataTierLabel={historicalTierLabel}
                    showVolumeProfile
                    events={events}
                />
            ) : historicalLoading ? (
                <GlassCard style={styles.chartPlaceholder} contentStyle={styles.chartPlaceholderContent} blurIntensity={Theme.blur.subtle}>
                    <Ionicons name="stats-chart" size={48} color={Theme.colors.glassBorder} />
                    <Text style={styles.chartText}>Loading historical data...</Text>
                </GlassCard>
            ) : (
                <GlassCard style={styles.chartPlaceholder} contentStyle={styles.chartPlaceholderContent} blurIntensity={Theme.blur.subtle}>
                    <Ionicons name="stats-chart" size={48} color={Theme.colors.glassBorder} />
                    <Text style={styles.chartText}>No historical data for {symbol}</Text>
                </GlassCard>
            )}
        </View>
    );
}
