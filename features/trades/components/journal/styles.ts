import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
    viewToggle: {
        marginBottom: Theme.spacing.lg,
    },
    headerRight: {
        justifyContent: 'center',
    },
    subtitleText: {
        fontSize: Theme.typography.sizes.sm,
        color: Theme.colors.textMuted,
        fontWeight: Theme.typography.weights.semibold,
        flexShrink: 1,
        flexGrow: 1,
    },
    marketDetailPill: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.full,
        overflow: 'hidden',
    },
    marketDetailText: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textSubtle,
        fontWeight: Theme.typography.weights.bold,
        letterSpacing: 0.5,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        color: Theme.colors.textMuted,
    },
    pendingSection: {
        marginBottom: Theme.spacing.lg,
    },
    pendingTitle: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
        marginBottom: Theme.spacing.md,
    },
    sectionHeader: {
        marginBottom: Theme.spacing.md,
    },
    placedTitle: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    pendingCard: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    pendingCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Theme.spacing.md,
    },
    pendingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    pendingIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Theme.colors.activeConfig,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingSymbol: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
    },
    pendingMeta: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    cancelButton: {
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.errorWash,
        borderWidth: 1,
        borderColor: Theme.colors.error,
    },
    cancelButtonText: {
        color: Theme.colors.error,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
        letterSpacing: 0.6,
    },
    ipadHeader: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    tableWrapper: {
        marginTop: Theme.spacing.sm,
    },
    symbolCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tableSymbol: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    tableAction: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tablePrimary: {
        fontSize: Theme.typography.sizes.sm,
        color: Theme.colors.text,
    },
    tableSecondary: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
    },
    tableCellRight: {
        alignItems: 'flex-end',
    },
    textSuccess: {
        color: Theme.colors.profit,
    },
    textDanger: {
        color: Theme.colors.loss,
    },
});
