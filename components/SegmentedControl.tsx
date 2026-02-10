import React, { memo } from 'react';
import { StyleProp, StyleSheet, ViewStyle, Platform } from 'react-native';
import SegmentedControlNative from '@react-native-segmented-control/segmented-control';
import GlassCard from './GlassCard';
import { Theme } from '../constants/theme';

interface SegmentedControlProps {
    options: string[];
    selectedIndex: number;
    onChange: (index: number) => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * Stable SegmentedControl using @react-native-segmented-control/segmented-control.
 * Styled with a "Dark Glass" aesthetic: Dark grey active segment with bright white text.
 */
const SegmentedControl = memo(({
    options,
    selectedIndex,
    onChange,
    style,
}: SegmentedControlProps) => {
    return (
        <GlassCard 
            style={[styles.container, style]} 
            contentStyle={styles.content} 
            blurIntensity={Theme.blur.controls}
            useNativeGlass={false}
        >
            <SegmentedControlNative
                values={options}
                selectedIndex={selectedIndex}
                onChange={(event) => {
                    onChange(event.nativeEvent.selectedSegmentIndex);
                }}
                appearance="dark"
                // Dark grey active pill for a subtle, premium look
                tintColor={Theme.colors.glassRelaxed} 
                backgroundColor="transparent"
                activeFontStyle={styles.activeText}
                fontStyle={styles.font}
                style={styles.nativeControl}
            />
        </GlassCard>
    );
});

SegmentedControl.displayName = 'SegmentedControl';

export default SegmentedControl;

const styles = StyleSheet.create({
    container: {
        borderRadius: Theme.borderRadius.full,
        height: 48,
        overflow: 'hidden',
    },
    content: {
        padding: Theme.spacing.xs,
        flex: 1,
    },
    nativeControl: {
        flex: 1,
        height: 40,
    },
    activeText: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.sm_lg,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    font: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm_lg,
        fontWeight: '500',
        letterSpacing: 0.3,
        ...Platform.select({
            ios: {
                fontWeight: '400',
            }
        })
    },
});
