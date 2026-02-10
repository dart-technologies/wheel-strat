import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassStyle, GlassView } from 'expo-glass-effect';
import { Theme } from '@/constants/theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    blurIntensity?: number;
    glassStyle?: GlassStyle;
    tint?: 'light' | 'dark';
    tintColor?: string;
    useNativeGlass?: boolean;
    useBlur?: boolean;
    isStale?: boolean;
    isHistorical?: boolean;
    onLayout?: (event: any) => void;
}

const GlassCard = memo(({
    children,
    style,
    contentStyle,
    blurIntensity = Theme.blur.medium,
    glassStyle = 'regular',
    tint = 'dark',
    tintColor = Theme.colors.glass,
    useNativeGlass = true,
    useBlur = true,
    isStale,
    isHistorical,
    onLayout,
}: GlassCardProps) => {
    const dataStyle = isStale ? Theme.data.stale : isHistorical ? Theme.data.historical : null;

    const containerStyle = [
        styles.container,
        dataStyle && {
            opacity: dataStyle.opacity,
            borderStyle: (dataStyle as any).borderStyle || 'solid',
        },
        style
    ];

    if (useNativeGlass) {
        return (
            <GlassView
                glassEffectStyle={glassStyle}
                tintColor={tintColor}
                isInteractive={!isStale}
                style={containerStyle}
                onLayout={onLayout}
            >
                {useBlur && (
                    <BlurView
                        intensity={blurIntensity}
                        tint={tint}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
                )}
                <View style={[styles.content, contentStyle]}>
                    {children}
                </View>
            </GlassView>
        );
    }

    return (
        <View style={containerStyle} onLayout={onLayout}>
            {useBlur && (
                <BlurView
                    intensity={blurIntensity}
                    tint={tint}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
            )}
            <View style={[styles.content, contentStyle]}>
                {children}
            </View>
        </View>
    );
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;

const styles = StyleSheet.create({
    container: {
        backgroundColor: Theme.colors.glassSubtle,
        borderRadius: Theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
    },
    content: {
        padding: Theme.layout.cardPadding,
    }
});
