import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Theme } from '../constants/theme';

export type PayoffGlyphType = 'cc' | 'csp';

interface PayoffGlyphProps {
    type: PayoffGlyphType;
    color?: string;
    size?: number;
}

const PayoffGlyph = memo(({
    type,
    color,
    size = 24,
}: PayoffGlyphProps) => {
    const stroke = color || (type === 'cc' ? Theme.colors.strategyCc : Theme.colors.strategyCsp);

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                {/* Subtle Axes */}
                <Path
                    d="M2 14H22"
                    stroke={Theme.colors.glassBorder}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                />
                <Path
                    d="M12 4V24"
                    stroke={Theme.colors.glassBorder}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                />

                {type === 'cc' ? (
                    <Path
                        d="M2 8H12L22 18"
                        stroke={stroke}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : (
                    <Path
                        d="M2 18L12 8H22"
                        stroke={stroke}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
            </Svg>
        </View>
    );
});

PayoffGlyph.displayName = 'PayoffGlyph';

export default PayoffGlyph;

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

