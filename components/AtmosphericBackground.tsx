import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRow } from 'tinybase/ui-react';
import { Theme } from '@/constants/theme';
import { store } from '@/data/store';

/**
 * AtmosphericBackground shifts the background accent color based on portfolio performance.
 * It provides a subtle green/red tint at the root level.
 */
export default function AtmosphericBackground() {
    const portfolio = useRow('portfolio', 'main', store);
    
    // We'll use a virtual 'performance' value between -1 (down) and 1 (up)
    // For now, let's just use a simple sign check
    const performance = useMemo(() => {
        const netLiq = Number(portfolio?.netLiq || 0);
        const cash = Number(portfolio?.cash || 0);
        const unrealizedPnL = netLiq - cash; // Very rough proxy if total cost isn't available here
        
        if (unrealizedPnL > 0) return 1;
        if (unrealizedPnL < 0) return -1;
        return 0;
    }, [portfolio]);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = withTiming(
            performance > 0 ? Theme.colors.breathingKai : performance < 0 ? Theme.colors.errorBanner : Theme.colors.backgroundAccent,
            { duration: Theme.motion.duration.ultraSlow }
        );

        return {
            backgroundColor,
        };
    });

    return (
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} />
    );
}
