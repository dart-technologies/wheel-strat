import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { typography, layout } from '@/utils/styles';

type TradeMetaRowProps = {
    strategy: string;
    expiration?: string;
    strike?: number | string;
    strategyColor?: string;
    containerStyle?: StyleProp<ViewStyle>;
    strategyTextStyle?: StyleProp<TextStyle>;
    metaTextStyle?: StyleProp<TextStyle>;
    showExpiration?: boolean;
    showStrike?: boolean;
};

export default function TradeMetaRow({
    strategy,
    expiration,
    strike,
    strategyColor,
    containerStyle,
    strategyTextStyle,
    metaTextStyle,
    showExpiration = true,
    showStrike = true
}: TradeMetaRowProps) {
    const strikeLabel = typeof strike === 'number'
        ? `$${strike}`
        : typeof strike === 'string'
            ? strike
            : '--';
    const hasExpiration = showExpiration && typeof expiration === 'string' && expiration.length > 0;
    const hasStrike = showStrike && strike !== undefined && strike !== null && String(strike).length > 0;

    return (
        <View style={[styles.metaRow, containerStyle]}>
            <Text style={[styles.strategy, strategyColor ? { color: strategyColor } : null, strategyTextStyle]}>
                {strategy}
            </Text>
            {hasExpiration && (
                <>
                    <View style={styles.metaDivider} />
                    <Text style={[styles.metaText, metaTextStyle]}>{expiration}</Text>
                </>
            )}
            {hasStrike && (
                <>
                    <View style={styles.metaDivider} />
                    <Text style={[styles.metaText, metaTextStyle]}>{strikeLabel}</Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    metaRow: {
        ...layout.flexRow('flex-start', 'center', Theme.spacing.sm),
        flexWrap: 'wrap',
    },
    strategy: {
        ...typography('xs', 'bold'),
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: Theme.colors.textMuted,
    },
    metaDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Theme.colors.textMuted,
    },
    metaText: {
        ...typography('xs', 'regular'),
        color: Theme.colors.textMuted,
    },
});
