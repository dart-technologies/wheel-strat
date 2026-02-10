import React, { useEffect } from 'react';
import { StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Theme } from '@/constants/theme';

interface MarketFeedStatusPillProps {
    connected: boolean;
    pulse?: boolean;
    style?: StyleProp<ViewStyle>;
}

export default function MarketFeedStatusPill({ connected, pulse = false, style }: MarketFeedStatusPillProps) {
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
                connected ? styles.connectedPill : styles.offlinePill,
                animatedStyle,
                style
            ]}
        >
            <Ionicons
                name="link-outline"
                size={12}
                color={connected ? Theme.colors.success : Theme.colors.error}
            />
            <Text style={[styles.text, connected ? styles.connectedText : styles.offlineText]}>
                {connected ? 'Connected' : 'Offline'}
            </Text>
        </Animated.View>
    );
}

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
    connectedPill: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    offlinePill: {
        backgroundColor: Theme.colors.errorWash,
        borderColor: Theme.colors.error,
    },
    text: {
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.extraBold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    connectedText: {
        color: Theme.colors.success,
    },
    offlineText: {
        color: Theme.colors.error,
    },
});
