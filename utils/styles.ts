import { ViewStyle, TextStyle } from 'react-native';
import { Theme, Colors, Shadows, Typography, Spacing } from '../constants/theme';

/**
 * Returns a shadow style object based on the predefined levels.
 */
export const shadow = (level: keyof typeof Shadows = 'md'): ViewStyle => {
    return Shadows[level] as ViewStyle;
};

/**
 * Returns a glass effect style object.
 * Note: For true blur on iOS, use the GlassCard component or BlurView.
 * This provides the visual fallback (transparency, border).
 */
export const glass = (intensity: 'subtle' | 'regular' | 'strong' = 'regular'): ViewStyle => {
    let backgroundColor = Colors.glass;
    if (intensity === 'subtle') backgroundColor = Colors.glassSubtle;
    if (intensity === 'strong') backgroundColor = Colors.glassStrong;

    return {
        backgroundColor,
        borderColor: Colors.glassBorder,
        borderWidth: 1,
    };
};

/**
 * Typography helper to get consistent text styles.
 */
export const typography = (
    size: keyof typeof Typography.sizes = 'base',
    weight: keyof typeof Typography.weights = 'regular'
): TextStyle => {
    return {
        fontFamily: Typography.fonts?.primary,
        fontSize: Typography.sizes[size],
        fontWeight: Typography.weights[weight] as TextStyle['fontWeight'],
        lineHeight: Typography.lineHeights[size],
        color: Colors.text,
    };
};

/**
 * Layout helper for common flex patterns.
 */
export const layout = {
    flexRow: (justify: ViewStyle['justifyContent'] = 'flex-start', align: ViewStyle['alignItems'] = 'center', gap?: number): ViewStyle => ({
        flexDirection: 'row',
        justifyContent: justify,
        alignItems: align,
        gap: gap ?? Spacing.elementGap,
    }),
    flexColumn: (justify: ViewStyle['justifyContent'] = 'flex-start', align: ViewStyle['alignItems'] = 'stretch', gap?: number): ViewStyle => ({
        flexDirection: 'column',
        justifyContent: justify,
        alignItems: align,
        gap: gap ?? Spacing.elementGap,
    }),
    fill: {
        flex: 1,
    } as ViewStyle,
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    } as ViewStyle,
    absoluteFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    } as ViewStyle,
};

/**
 * Spacing helper.
 * @example spacing(2) -> 16 (if md is 16) - simplistic multiplier or mapped access
 * Currently mapped to Spacing object.
 */
export const getSpacing = (size: keyof typeof Spacing): number => {
    return Spacing[size];
};
