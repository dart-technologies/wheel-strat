import React, { useEffect } from 'react';
import { View, StyleSheet, DimensionValue } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { Theme } from "../constants/theme";
import GlassCard from "./GlassCard";

export const Skeleton = ({
    width = "100%",
    height = 20,
    borderRadius = Theme.borderRadius.sm,
    style
}: {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: any;
}) => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, {
                    duration: Theme.motion.duration.skeletonPulse || 1000,
                    easing: Easing.inOut(Easing.ease)
                }),
                withTiming(0.3, {
                    duration: Theme.motion.duration.skeletonPulse || 1000,
                    easing: Easing.inOut(Easing.ease)
                })
            ),
            -1,
            false
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                },
                animatedStyle,
                style
            ]}
        />
    );
};

export const SkeletonCard = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.header}>
            <Skeleton width="40%" height={24} />
            <Skeleton width="20%" height={20} />
        </View>
        <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="80%" height={16} />
    </GlassCard>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: Theme.colors.glass, // Use glass or specific surface-light equivalent. Using glass for now.
    },
    card: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
    },
    cardContent: {
        padding: Theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.md,
    }
});
