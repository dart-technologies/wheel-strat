import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme } from '@/constants/theme';
import GlassCard from '@/components/GlassCard';
import { Skeleton } from '@/components/Skeleton';

export default function OpportunityCardSkeleton() {
    return (
        <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Skeleton width={80} height={28} borderRadius={8} />
                </View>
                <Skeleton width={60} height={24} borderRadius={6} />
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View>
                    <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
                    <Skeleton width={40} height={16} />
                </View>
                <View>
                    <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
                    <Skeleton width={40} height={16} />
                </View>
                <View>
                    <Skeleton width={60} height={12} style={{ marginBottom: 4 }} />
                    <Skeleton width={60} height={16} />
                </View>
            </View>

            {/* Analysis Box */}
            <View style={styles.analysisBox}>
                <Skeleton width="40%" height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={24} borderRadius={8} style={{ marginBottom: 12 }} />
                <Skeleton width="100%" height={60} borderRadius={4} />
            </View>

            {/* Button */}
            <Skeleton width="100%" height={36} borderRadius={8} />
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.md,
    },
    cardContent: {
        padding: Theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    statsRow: {
        flexDirection: 'row',
        gap: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
    },
    analysisBox: {
        marginBottom: Theme.spacing.md,
        backgroundColor: Theme.colors.glassStrong,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    }
});
