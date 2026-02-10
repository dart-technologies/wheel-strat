import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from "../constants/theme";
import BridgeStatus from './BridgeStatus';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    subtitleElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    showBridgeStatus?: boolean;
}

export default function PageHeader({ title, subtitle, subtitleElement, rightElement, showBridgeStatus }: PageHeaderProps) {
    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <View style={styles.titleRow}>
                    <Text style={styles.title} testID="page-title">{title}</Text>
                    {showBridgeStatus && <BridgeStatus />}
                </View>
                {rightElement && (
                    <View style={styles.rightSide}>
                        {rightElement}
                    </View>
                )}
            </View>
            {subtitleElement ? (
                <View style={styles.subtitleRow}>
                    {subtitleElement}
                </View>
            ) : subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: Theme.spacing.lg,
        paddingBottom: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.sm,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // Center vertically with title
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        flex: 1, // Let title take space
    },
    rightSide: {
        marginLeft: Theme.spacing.md,
        alignSelf: 'center',
    },
    title: {
        fontSize: Theme.typography.sizes.display,
        fontWeight: Theme.typography.weights.extraBold, // Making it heavier for premium feel
        color: Theme.colors.text,
        fontFamily: Theme.typography.fonts.display,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: Theme.typography.sizes.sm,
        color: Theme.colors.textMuted,
        fontWeight: Theme.typography.weights.semibold,
        marginTop: 4,
        fontFamily: Theme.typography.fonts.primary,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        flexWrap: 'nowrap',
        marginTop: 6,
        width: '100%',
    },
});
