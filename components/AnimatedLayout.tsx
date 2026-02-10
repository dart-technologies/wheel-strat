import React, { useMemo } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    withDelay, 
    withTiming, 
    useSharedValue,
    Easing
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Theme } from '../constants/theme';

interface AnimatedLayoutProps {
    children: React.ReactNode;
    style?: ViewStyle;
    delay?: number;
}

export default function AnimatedLayout({ children, style, delay = 0 }: AnimatedLayoutProps) {
    const opacity = useSharedValue(0);
    const fadeDuration = useMemo(() => Theme.motion.duration.slow + 150, []);
    const fadeEasing = useMemo(() => Easing.out(Easing.cubic), []);

    useFocusEffect(
        React.useCallback(() => {
            opacity.value = 0;
            opacity.value = withDelay(delay, withTiming(1, {
                duration: fadeDuration,
                easing: fadeEasing
            }));

            return () => {
                opacity.value = withTiming(0, {
                    duration: Math.round(fadeDuration * 0.8),
                    easing: fadeEasing
                });
            };
        }, [delay, opacity, fadeDuration, fadeEasing])
    );

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
            {children}
        </Animated.View>
    );
}
