import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
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
    card: {
        marginHorizontal: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.xl,
    },
    overviewContent: {
        padding: 0,
    },
    performanceHeader: {
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.dividerLine,
    },
    performanceEyebrow: {
        fontSize: 9,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600',
    },
    cardLabel: {
        color: Theme.colors.textMuted,
        fontWeight: Theme.typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: Theme.typography.sizes.xs,
    },
    textMuted: {
        color: Theme.colors.textMuted,
    },
    textSuccess: {
        color: Theme.colors.profit,
    },
    textDanger: {
        color: Theme.colors.loss,
    },
    netLiqValue: {
        fontSize: Theme.typography.sizes.display,
        fontWeight: Theme.typography.weights.extraBold,
        color: Theme.colors.text,
    },
    overviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: Theme.spacing.md,
    },
    dayChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        marginTop: Theme.spacing.xs,
    },
    dayChangeLabel: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
    },
    dayChangeValue: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
    },
    dayChangePct: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
    },
    overviewSide: {
        alignItems: 'flex-end',
        gap: Theme.spacing.xs,
    },
    statusChip: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.primarySoft,
        borderWidth: 1,
        borderColor: Theme.colors.primary,
    },
    statusChipText: {
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.primary,
        letterSpacing: 1,
    },
    statusChipWarning: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.warningWash,
        borderWidth: 1,
        borderColor: Theme.colors.warning,
    },
    statusChipTextWarning: {
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.warning,
        letterSpacing: 1,
    },
    overviewHint: {
        fontSize: Theme.typography.sizes.xs,
        color: Theme.colors.textMuted,
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.md,
    },
    metricCell: {
        paddingHorizontal: Theme.spacing.md,
        paddingBottom: Theme.spacing.xs,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center',
    },
    metricValue: {
        ...Theme.typography.numeric,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
        marginTop: 4,
        textAlign: 'center',
    },
    metricSubLabel: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textSubtle,
        marginTop: 2,
        textAlign: 'center',
    },
    metricSkeletonStack: {
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    metricSkeleton: {
        borderRadius: Theme.borderRadius.sm,
    },
    metricSkeletonSub: {
        borderRadius: Theme.borderRadius.sm,
        opacity: 0.7,
    },
    section: {
        paddingHorizontal: Theme.spacing.lg,
        marginTop: Theme.spacing.lg,
    },
    sectionWide: {
        paddingHorizontal: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
        gap: Theme.spacing.md,
    },
    sectionTitle: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
    },
    sortControl: {
        minWidth: 180,
    },
    tableWrapper: {
        marginBottom: Theme.spacing.lg,
    },
    tableSymbol: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    tableTotalText: {
        fontWeight: Theme.typography.weights.bold,
    },
    tableMeta: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    sparklineRow: {
        marginTop: Theme.spacing.xs,
    },
    tableTotalMeta: {
        color: Theme.colors.textSubtle,
    },
    tablePrimary: {
        fontSize: Theme.typography.sizes.sm,
        color: Theme.colors.text,
    },
    tableSecondary: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
        marginTop: 2,
    },
    tableCellRight: {
        alignItems: 'flex-end',
    },
    tableCellRightText: {
        textAlign: 'right',
    },
    skeletonCell: {
        marginTop: 2,
    },
    skeletonCellSub: {
        marginTop: 6,
        opacity: 0.7,
    },
    scanButtonDisabled: {
        opacity: Theme.opacity.visible,
    },
    itemWrapper: {
        paddingHorizontal: Theme.spacing.lg,
    },
    optionList: {
        paddingHorizontal: Theme.spacing.xs,
        marginTop: Theme.spacing.xs,
    },
    ipadHeader: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    ipadTopRow: {
        flexDirection: 'row',
        gap: Theme.spacing.lg,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    ipadSummaryCard: {
        flex: 1,
        marginHorizontal: 0,
    },
    ipadChartPlaceholder: {
        flex: 1.5,
    },
    chartPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        marginTop: Theme.spacing.md,
    },
    chartPlaceholderText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    ipadItemWrapper: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        flex: 1,
    }
});
