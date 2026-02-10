import React, { useEffect, memo } from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Theme } from '@/constants/theme';

interface MarketStatusPillProps {
    isOpen: boolean;
    pulse?: boolean;
    style?: StyleProp<ViewStyle>;
}

const MarketStatusPill = memo(({ isOpen, pulse = false, style }: MarketStatusPillProps) => {
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (pulse) {
            opacity.value = withRepeat(
                withTiming(0.5, { duration: Theme.motion.duration.breathing, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            opacity.value = withTiming(1, { duration: Theme.motion.duration.medium });
        }
    }, [pulse, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.pill,
                isOpen ? styles.openPill : styles.closedPill,
                animatedStyle,
                style
            ]}
        >
            <Ionicons
                name={isOpen ? "pulse" : "moon-outline"}
                size={12}
                color={isOpen ? Theme.colors.success : Theme.colors.error}
            />
            <Text style={[styles.text, isOpen ? styles.openText : styles.closedText]}>
                {isOpen ? 'Open' : 'Closed'}
            </Text>
        </Animated.View>
    );
});

MarketStatusPill.displayName = 'MarketStatusPill';

export default MarketStatusPill;

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
    },
    openPill: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    closedPill: {
        backgroundColor: Theme.colors.errorWash,
        borderColor: Theme.colors.error,
    },
    text: {
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.extraBold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    openText: {
        color: Theme.colors.success,
    },
    closedText: {
        color: Theme.colors.error,
    },
});
