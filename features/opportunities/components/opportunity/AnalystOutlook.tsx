import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';
import { OpportunityAnalysis } from '@wheel-strat/shared';

interface AnalystOutlookProps {
    scenarios?: OpportunityAnalysis['scenarios'];
}

const getScenarioColor = (type: 'bull' | 'bear' | 'sideways') => {
    switch (type) {
        case 'bull': return Theme.colors.success;
        case 'bear': return Theme.colors.error;
        case 'sideways': return Theme.colors.warning;
        default: return Theme.colors.textMuted;
    }
};

const ScenarioBar = ({ scenario, index, data }: { scenario: 'bull' | 'bear' | 'sideways', index: number, data: any }) => {
    const rawProb = data?.probability ?? 0;
    const prob = typeof rawProb === 'string' ? parseFloat(rawProb) : rawProb;
    const widthPct = Number.isNaN(prob) ? 33 : prob;

    const flexVal = useSharedValue(0);

    useEffect(() => {
        // Stagger animation based on index
        flexVal.value = withDelay(index * 100, withTiming(widthPct, { duration: 800 }));
    }, [widthPct, index]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            flex: flexVal.value,
        };
    });

    return (
        <Animated.View style={[
            styles.stackedSegment,
            animatedStyle,
            {
                backgroundColor: getScenarioColor(scenario),
                borderTopLeftRadius: index === 0 ? Theme.borderRadius.sm : 0,
                borderBottomLeftRadius: index === 0 ? Theme.borderRadius.sm : 0,
                borderTopRightRadius: index === 2 ? Theme.borderRadius.sm : 0,
                borderBottomRightRadius: index === 2 ? Theme.borderRadius.sm : 0,
            }
        ]}>
            {widthPct > 15 && (
                <Text style={styles.segmentLabel}>{data?.probability ?? '--'}</Text>
            )}
        </Animated.View>
    );
};

export default function AnalystOutlook({ scenarios }: AnalystOutlookProps) {
    return (
        <View>
            <Text style={styles.sectionTitle}>Analyst Outlook & Probabilities</Text>
            <View style={styles.stackedBarContainer}>
                {(['bear', 'sideways', 'bull'] as const).map((scenario, index) => (
                    <ScenarioBar
                        key={scenario}
                        scenario={scenario}
                        index={index}
                        data={scenarios?.[scenario]}
                    />
                ))}
            </View>
            <View style={styles.stackedLabels}>
                <Text style={[styles.legendText, { color: Theme.colors.error }]}>Bear</Text>
                <Text style={[styles.legendText, { color: Theme.colors.warning }]}>Sideways</Text>
                <Text style={[styles.legendText, { color: Theme.colors.success }]}>Bull</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        ...typography('xs', 'bold'),
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.sm,
        textTransform: 'uppercase',
    },
    stackedBarContainer: {
        flexDirection: 'row',
        height: 24,
        borderRadius: Theme.borderRadius.sm,
        overflow: 'hidden',
        marginBottom: Theme.spacing.xs,
        backgroundColor: Theme.colors.glassBorder,
    },
    stackedSegment: {
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    segmentLabel: {
        ...typography('xs', 'bold'),
        color: Theme.colors.textOnLight,
    },
    stackedLabels: {
        ...layout.flexRow('space-between', 'center', 0),
        marginBottom: Theme.spacing.md,
        paddingHorizontal: 2,
    },
    legendText: {
        ...typography('xs', 'bold'),
    },
});
