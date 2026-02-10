import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * Custom Design System
 * Centralized source of truth for all styling tokens
 */

export const Colors = {
    background: '#1A1D29',
    backgroundAccent: '#0A2540',
    surface: '#252833',
    primary: '#CE93D8',
    secondary: '#0A2540',
    error: '#FF1744',
    warning: '#FF6B00',
    success: '#00C853',
    info: '#9C27B0',
    text: '#E8EAED',
    textMuted: '#B5BBC7',
    textSubtle: '#7C828E',
    textMutedSoft: 'rgba(255, 255, 255, 0.25)',
    textOnLight: 'rgba(0, 0, 0, 0.7)',
    glassUltraSubtle: 'rgba(255, 255, 255, 0.02)',
    glassSubtle: 'rgba(255, 255, 255, 0.05)',
    glass: 'rgba(255, 255, 255, 0.08)',
    glassStrong: 'rgba(255, 255, 255, 0.12)',
    glassRelaxed: 'rgba(255, 255, 255, 0.15)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    glassBorderStrong: 'rgba(255, 255, 255, 0.18)',
    scrim: 'rgba(10, 12, 20, 0.7)',
    modalScrim: 'rgba(0, 0, 0, 0.6)',
    atmosphereOverlay: 'rgba(6, 10, 20, 0.35)',
    primarySoft: 'rgba(156, 39, 176, 0.12)',
    primaryWash: 'rgba(156, 39, 176, 0.18)',
    errorWash: 'rgba(255, 23, 68, 0.16)',
    warningWash: 'rgba(255, 107, 0, 0.18)',
    successWash: 'rgba(0, 200, 83, 0.14)',
    infoWash: 'rgba(0, 212, 255, 0.14)',
    errorBanner: 'rgba(60, 12, 20, 0.85)',
    errorScrim: 'rgba(60, 12, 20, 0.92)',
    errorBorderSoft: 'rgba(255, 23, 68, 0.35)',
    atmosphereLuna: '#0D1220',
    atmosphereKai: '#0B1B26',
    atmosphereRiver: '#111726',
    breathingLuna: 'rgba(10, 37, 64, 0.35)',
    breathingKai: 'rgba(156, 39, 176, 0.2)',
    profit: '#00C853',
    loss: '#FF1744',
    chartUp: '#00C853',
    chartDown: '#FF1744',
    strategyCc: '#00D4FF',
    strategyCcWash: 'rgba(0, 212, 255, 0.18)',
    strategyCsp: '#FF6B00',
    strategyCspWash: 'rgba(255, 107, 0, 0.18)',
    dataLive: '#9C27B0',
    dataLiveWash: 'rgba(156, 39, 176, 0.18)',
    dataStale: '#8E8E93',
    dataStaleWash: 'rgba(142, 142, 147, 0.18)',
    dataDerived: '#FFC857',
    dataDerivedWash: 'rgba(255, 200, 87, 0.18)',
    impactMedium: '#f59e0b',
    dataMocked: '#9AA3B2',
    dataMockedWash: 'rgba(154, 163, 178, 0.18)',
    tradingPaper: '#5C6BC0',
    tradingPaperWash: 'rgba(92, 107, 192, 0.18)',
    icon: '#E8EAED',
    iconMuted: '#9AA2B1',
    border: 'rgba(255, 255, 255, 0.12)',
    activeConfig: 'rgba(156, 39, 176, 0.15)',
    activeConfigBorder: 'rgba(156, 39, 176, 0.35)',
    dividerLine: 'rgba(255, 255, 255, 0.1)',
    guestBorder: 'rgba(52, 152, 219, 0.5)',
    google: '#DB4437',
    skeletonStrong: 'rgba(255, 255, 255, 0.2)',
    skeletonSoft: 'rgba(255, 255, 255, 0.1)',
    toggleTrackOff: '#767577',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
};

export const Spacing = {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md_inner: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xl_plus: 40,
    xxl: 48,
    xxxl: 64,
    xxxl_plus: 50,
    pagePadding: 24,
    cardPadding: 24,
    elementGap: 16,
    sectionGap: 32,
};

export const Blur = {
    none: 0,
    subtle: 10,
    soft: 20,
    medium: 30,
    controls: 40,
    strong: 60,
    tabBar: 80,
};

/**
 * Superpremium Motion System
 */
export const Motion = {
    duration: {
        ultraFast: 100,
        fast: 200,
        medium: 400,
        slow: 600,
        ultraSlow: 1000,
        toast: 500,
        skeletonPulse: 1500,
        breathing: 2500,
    },
    easing: {
        // High-end cubic beziers
        standard: Easing.bezier(0.4, 0, 0.2, 1),
        accelerate: Easing.bezier(0.4, 0, 1, 1),
        decelerate: Easing.bezier(0, 0, 0.2, 1),
        bounce: Easing.bezier(0.175, 0.885, 0.32, 1.275),
    },
    layout: {
        spring: {
            damping: 20,
            stiffness: 90,
            mass: 1,
        }
    }
};

export const Opacity = {
    none: 0,
    faint: 0.05,
    subtle: 0.1,
    medium: 0.3,
    heavy: 0.6,
    visible: 0.8,
    full: 1,
};

export const DataHierarchy = {
    live: {
        opacity: 1,
        saturation: 1,
        badge: true,
        pulse: true,
    },
    fresh: {
        opacity: 1,
        saturation: 1,
        badge: false,
        pulse: false,
    },
    stale: {
        opacity: 0.6,
        saturation: 0.2,
        badge: true,
        pulse: false,
    },
    historical: {
        opacity: 0.8,
        saturation: 0.5,
        badge: true,
        pulse: false,
        borderStyle: 'dashed' as const,
    }
};

export const Typography = {
    fonts: {
        primary: Platform.select({
            ios: 'SF Pro Text',
            android: 'Roboto',
            default: 'System',
        })!,
        display: Platform.select({
            ios: 'SF Pro Display',
            android: 'Roboto',
            default: 'System',
        })!,
        mono: Platform.select({
            ios: 'SF Mono',
            android: 'Roboto Mono',
            default: 'monospace',
        })!,
    },
    sizes: {
        xxs: 9,
        xs: 10,
        xs_lg: 11,
        sm: 12,
        sm_lg: 13,
        md: 14,
        md_lg: 15,
        base: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        display: 34,
        display_plus: 36,
        displayLg: 48,
        displayXl: 64,
    },
    weights: {
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extraBold: '800',
        black: '900',
        primary: '500',
        secondary: '300',
    },
    // Pro-app numeric display
    numeric: {
        fontVariant: ['tabular-nums'] as any,
        fontFamily: Platform.select({
            ios: 'SF Mono',
            android: 'Roboto Mono',
            default: 'monospace',
        })!,
    },
    lineHeights: {
        xxs: 12,
        xs: 14,
        xs_lg: 15,
        sm: 18,
        sm_lg: 20,
        md: 22,
        md_lg: 24,
        base: 24,
        lg: 28,
        xl: 32,
        xxl: 36,
        display: 42,
        display_plus: 44,
        displayLg: 56,
        displayXl: 76,
    },
} as const;

export const BorderRadius = {
    none: 0,
    xxs: 2,
    xs_inner: 3,
    xs: 4,
    sm_inner: 6,
    sm: 8,
    md: 12,
    lg: 16,
    lg_plus: 18,
    xl_lg: 22,
    xl: 24,
    xxl: 32,
    full: 9999,
};

export const Shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0,
    },
    sm: {
        shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 1.0, elevation: 1,
    },
    md: {
        shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
    },
    lg: {
        shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 4.65, elevation: 8,
    },
    xl: {
        shadowColor: Colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.44, shadowRadius: 10.32, elevation: 16,
    },
};

export const Theme = {
    colors: Colors,
    spacing: Spacing,
    borderRadius: BorderRadius,
    blur: Blur,
    motion: Motion,
    opacity: Opacity,
    data: DataHierarchy,
    typography: Typography,
    shadows: Shadows,
    glass: {
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        backdropFilter: 'blur(16px)',
    },
    shadow: Shadows.xl,
    layout: {
        pagePadding: Spacing.pagePadding,
        cardPadding: Spacing.cardPadding,
        elementGap: Spacing.elementGap,
        sectionGap: Spacing.sectionGap,
        buttonHeight: 56,
        logoSize: 96,
        iconSize: {
            xs: 12, sm: 16, md: 24, lg: 32, xl: 48,
        }
    }
};
