import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
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
    selectorContainer: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.md,
    },
    selectorContainerWide: {
        paddingHorizontal: 0,
    },
    segmentControl: {
        width: '100%',
    },
    tableWrapper: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
    },
    tableSymbol: {
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
        color: Theme.colors.text,
    },
    tableMeta: {
        fontSize: Theme.typography.sizes.xxs,
        color: Theme.colors.textMuted,
        marginTop: 2,
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
    tableCenter: {
        textAlign: 'center',
    },
    scanButtonDisabled: {
        opacity: Theme.opacity.visible, // was 0.7
    },
    infoCard: {
        borderRadius: Theme.borderRadius.xl,
        marginVertical: Theme.spacing.lg,
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
        padding: Theme.spacing.lg,
    },
    infoText: {
        flex: 1,
        color: Theme.colors.textMuted,
        lineHeight: 20,
        fontSize: Theme.typography.sizes.md,
    },
    synopsisCard: {
        marginTop: Theme.spacing.md,
        borderRadius: Theme.borderRadius.xl,
    },
    synopsisContent: {
        padding: Theme.spacing.lg,
    },
    synopsisHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
    },
    synopsisHeaderTitle: {
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.bold,
        fontSize: Theme.typography.sizes.sm,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    synopsisText: {
        color: Theme.colors.text,
        fontSize: 15,
        lineHeight: 24,
    },
    synopsisCardStale: {
        borderColor: Theme.colors.dataStale,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderLeftColor: Theme.colors.dataStale,
        backgroundColor: Theme.colors.dataStaleWash,
    },
    analysisSection: {
        marginBottom: Theme.spacing.lg,
    },
    reportCard: {
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.lg,
    },
    reportContent: {
        padding: Theme.spacing.lg,
    },
    reportHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    reportTitle: {
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.bold,
        fontSize: Theme.typography.sizes.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    reportHeadline: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
        marginBottom: Theme.spacing.sm,
    },
    reportSynopsis: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.md,
        lineHeight: 22,
        marginBottom: Theme.spacing.sm,
    },
    reportBody: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    reportMeta: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        marginTop: Theme.spacing.sm,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    dateEvent: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
    },
    dateSymbols: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    dateDate: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    impactBadge: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    impactHigh: {
        color: Theme.colors.error,
    },
    impactMedium: {
        color: Theme.colors.impactMedium,
    },
    impactLow: {
        color: Theme.colors.textMuted,
    },
    topOpportunityCard: {
        marginBottom: Theme.spacing.md,
    },
    staleHint: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        marginBottom: Theme.spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        color: Theme.colors.textMuted,
        fontStyle: 'italic',
    },
    itemWrapper: {
        paddingHorizontal: Theme.spacing.lg,
    },
    itemStale: {
        opacity: 0.5,
    },
    ipadHeader: {
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    ipadItemWrapper: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        flex: 1,
    }
});
