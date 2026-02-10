import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing,
    cancelAnimation,
    FadeIn
} from 'react-native-reanimated';
import { Theme } from '@/constants/theme';
import { formatTimeSince, DateInput } from '@/utils/time';

interface FreshnessIndicatorProps {
    lastUpdated: DateInput;
    isRefreshing?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * Centralized freshness indicator using a subtle system pill aesthetic.
 * Replaces the word "ago" with a history/clock icon for a cleaner technical look.
 */
const FreshnessIndicator = memo(({ lastUpdated, isRefreshing, style }: FreshnessIndicatorProps) => {
    const timeLabel = formatTimeSince(lastUpdated, { lowercase: true, compact: true });
    const spin = useSharedValue(0);

    useEffect(() => {
        if (isRefreshing) {
            spin.value = withRepeat(
                withTiming(1, { duration: 1000, easing: Easing.linear }),
                -1,
                false
            );
        } else {
            // Smoothly complete the current rotation and reset
            spin.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
        }
        return () => cancelAnimation(spin);
    }, [isRefreshing, spin]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${spin.value * 360}deg` },
            { scale: withTiming(isRefreshing ? 1.1 : 1, { duration: 300 }) }
        ],
        opacity: withTiming(isRefreshing ? 1 : 0.7, { duration: 300 }),
    }));
    
    if (!timeLabel || timeLabel === '--') {
        return (
            <View style={[styles.container, styles.empty, style]}>
                <Text style={styles.label}>--</Text>
            </View>
        );
    }

    return (
        <Animated.View 
            entering={FadeIn.duration(Theme.motion.duration.medium)}
            style={[styles.container, style]}
        >
            <Text style={styles.label}>{timeLabel}</Text>
            <Animated.View style={animatedIconStyle}>
                <Ionicons name="refresh-circle" size={14} color={Theme.colors.textMuted} />
            </Animated.View>
        </Animated.View>
    );
});

FreshnessIndicator.displayName = 'FreshnessIndicator';

export default FreshnessIndicator;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // Darker background for inset look
        paddingLeft: Theme.spacing.sm,
        paddingRight: 4, // Tighter on the icon side
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        overflow: 'hidden',
    },
    empty: {
        paddingHorizontal: Theme.spacing.md,
    },
    label: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textSubtle, // Muted text for subtle inset look
        fontWeight: Theme.typography.weights.bold,
        textTransform: 'lowercase',
        letterSpacing: 0.5,
    },
});
