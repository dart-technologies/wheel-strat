import React, { useEffect, memo } from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing 
} from 'react-native-reanimated';
import { Theme } from '../constants/theme';

export type DataTier = 'live' | 'stale' | 'derived' | 'mocked';

const LABELS: Record<DataTier, string> = {
    live: 'LIVE',
    stale: 'STALE',
    derived: 'DERIVED',
    mocked: 'MOCKED',
};

const COLORS: Record<DataTier, { text: string; background: string; border: string }> = {
    live: {
        text: Theme.colors.dataLive,
        background: Theme.colors.dataLiveWash,
        border: Theme.colors.dataLive,
    },
    stale: {
        text: Theme.colors.dataStale,
        background: Theme.colors.dataStaleWash,
        border: Theme.colors.dataStale,
    },
    derived: {
        text: Theme.colors.dataDerived,
        background: Theme.colors.dataDerivedWash,
        border: Theme.colors.dataDerived,
    },
    mocked: {
        text: Theme.colors.dataMocked,
        background: Theme.colors.dataMockedWash,
        border: Theme.colors.dataMocked,
    },
};

const DataTierBadge = memo(({
    tier,
    label,
    style,
}: {
    tier: DataTier;
    label?: string;
    style?: StyleProp<ViewStyle>;
}) => {
    const colors = COLORS[tier];
    const isLive = tier === 'live';
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (isLive) {
            opacity.value = withRepeat(
                withTiming(0.4, { 
                    duration: Theme.motion.duration.breathing, 
                    easing: Easing.inOut(Easing.ease) 
                }),
                -1,
                true
            );
        }
    }, [isLive, opacity]);

    const dotStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={[
            styles.badge,
            { backgroundColor: colors.background, borderColor: colors.border },
            style
        ]}>
            {isLive && (
                <Animated.View style={[styles.dot, { backgroundColor: colors.text }, dotStyle]} />
            )}
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.badgeText, { color: colors.text }]}
            >
                {label ?? LABELS[tier]}
            </Text>
        </View>
    );
});

DataTierBadge.displayName = 'DataTierBadge';

export default DataTierBadge;

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        maxWidth: 140,
        flexShrink: 1,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: Theme.borderRadius.xs_inner,
    },
    badgeText: {
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.extraBold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        flexShrink: 1,
    },
});
