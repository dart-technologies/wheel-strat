import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
    headerRight: {
        justifyContent: 'center',
    },
    emptyState: {
        paddingTop: Theme.spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        textAlign: 'center',
    },
    emptyStateText: {
        color: Theme.colors.textMuted,
        textAlign: 'center',
        marginTop: 20,
    },
    ipadHeader: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    skeletonCard: {
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    skeletonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.lg,
    },
    skeletonInfo: { flex: 1 },
    skeletonMetric: { alignItems: 'flex-end' },
    modalOverlay: {
        flex: 1,
        backgroundColor: Theme.colors.modalScrim,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Theme.colors.background,
        borderTopLeftRadius: Theme.borderRadius.xl,
        borderTopRightRadius: Theme.borderRadius.xl,
        padding: Theme.spacing.lg,
        maxHeight: '75%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    modalTitle: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
    },
    modalSubtitle: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    modalClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Theme.colors.glass,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    historyList: {
        paddingBottom: Theme.spacing.lg,
        gap: Theme.spacing.md,
    },
    historyCard: { borderRadius: Theme.borderRadius.lg },
    historyContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.md,
    },
    historySymbol: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.semibold,
    },
    historyMeta: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    historyYield: { alignItems: 'flex-end' },
    historyYieldLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    historyYieldValue: {
        color: Theme.colors.success,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
    },
    tableWrapper: { marginTop: Theme.spacing.sm },
    rankContainer: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankEmoji: {
        fontSize: 28,
        textAlign: 'center',
    },
    rankNumberText: {
        fontSize: 22,
        fontWeight: Theme.typography.weights.bold,
        textAlign: 'center',
    },
    rankText: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.white,
    },
    tableName: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    tablePrimary: {
        fontSize: Theme.typography.sizes.md,
        color: Theme.colors.text,
    },
    tableCellRight: { alignItems: 'flex-end' },
    textSuccess: { color: Theme.colors.profit },
    errorText: {
        color: Theme.colors.error,
        fontSize: Theme.typography.sizes.xs,
    },
});
