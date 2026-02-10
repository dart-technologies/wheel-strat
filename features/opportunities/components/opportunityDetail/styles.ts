import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { layout, typography } from '@/utils/styles';

export const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    screen: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: Theme.layout.pagePadding,
    },
    loadingContainer: {
        ...layout.center,
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    closeButton: {
        padding: 4,
    },
    headerSkeleton: {
        ...layout.flexRow("space-between", "flex-end"),
        marginBottom: Theme.spacing.lg,
    },
    skeletonGap: {
        marginBottom: 4,
    },
    skeletonRight: {
        alignItems: "flex-end",
    },
    actionRow: {
        ...layout.flexRow("space-between", "center", Theme.spacing.md),
        marginBottom: Theme.spacing.lg,
    },
    heroCard: {
        marginBottom: Theme.layout.elementGap,
    },
    heroContent: {
        gap: Theme.spacing.md,
    },
    heroTop: {
        ...layout.flexRow("space-between", "flex-start", Theme.spacing.md),
        flexWrap: "wrap",
        rowGap: Theme.spacing.sm,
    },
    heroLeft: {
        flex: 1,
        minWidth: 160,
    },
    heroRight: {
        alignItems: "flex-end",
    },
    symbol: {
        ...typography("xxl", "bold"),
        fontFamily: Theme.typography.fonts.display,
        color: Theme.colors.text,
        lineHeight: 30,
    },
    yieldValue: {
        ...typography("xl", "bold"),
        color: Theme.colors.success,
    },
    yieldLabel: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.textMuted,
        marginBottom: Theme.spacing.xs,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    dataRow: {
        ...layout.flexRow("flex-end", "center", Theme.spacing.sm),
        marginTop: Theme.spacing.xs,
        flexWrap: "wrap",
    },
    dataAge: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.textMuted,
    },
    metricTable: {
        borderTopWidth: 1,
        borderTopColor: Theme.colors.glassBorder,
        marginTop: Theme.spacing.xs,
    },
    metricEmptyText: {
        ...typography("xs", "semibold"),
        color: Theme.colors.textMuted,
        textAlign: "center",
        width: "100%",
    },
    metricRow: {
        ...layout.flexRow("space-between", "center"),
        paddingVertical: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    metricLabel: {
        ...typography("xxs", "bold"),
        color: Theme.colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    metricValue: {
        ...typography("sm", "bold"),
        color: Theme.colors.text,
    },
    fitRow: {
        ...layout.flexRow("flex-start", "center", Theme.spacing.sm),
        flexWrap: "wrap",
    },
    fitChip: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
    },
    fitChipActive: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    fitChipMuted: {
        backgroundColor: Theme.colors.glassSubtle,
        borderColor: Theme.colors.glassBorder,
    },
    autoChipReady: {
        backgroundColor: Theme.colors.successWash,
        borderColor: Theme.colors.success,
    },
    autoChipReview: {
        backgroundColor: Theme.colors.warningWash,
        borderColor: Theme.colors.warning,
    },
    fitText: {
        ...typography("xxs", "bold"),
        color: Theme.colors.text,
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    cycleRow: {
        ...layout.flexRow("flex-start", "center", Theme.spacing.sm),
        flexWrap: "wrap",
    },
    cycleChip: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
    },
    cycleChipActive: {
        borderColor: Theme.colors.primary,
        backgroundColor: Theme.colors.activeConfig,
    },
    cycleChipMuted: {
        opacity: 0.7,
    },
    cycleText: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.text,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    sectionCard: {
        marginBottom: Theme.layout.elementGap,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    performanceCard: {
        padding: 0,
    },
    performanceContent: {
        paddingHorizontal: Theme.spacing.md,
        paddingTop: Theme.spacing.md,
        paddingBottom: Theme.spacing.sm,
    },
    sectionHeader: {
        ...layout.flexRow("flex-start", "center", 6),
        marginBottom: Theme.spacing.md,
        flexWrap: "wrap",
    },
    sectionTitle: {
        ...typography("xxs", "bold"),
        color: Theme.colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1.5,
    },
    patternChip: {
        marginTop: Theme.spacing.xs,
        alignSelf: "flex-start",
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
        maxWidth: "100%",
        flexBasis: "100%",
        flexShrink: 1,
    },
    patternText: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.text,
        flexShrink: 1,
    },
    statsGrid: {
        ...layout.flexRow("space-between", "center", Theme.spacing.xs),
    },
    statBox: {
        flex: 1,
        padding: Theme.spacing.xs,
        alignItems: "center",
    },
    statLabel: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.textMuted,
        marginBottom: 4,
    },
    statValue: {
        ...typography("sm", "bold"),
        color: Theme.colors.text,
    },
    asymmetryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: Theme.spacing.sm,
    },
    asymmetryTile: {
        width: "48%",
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.sm,
    },
    asymmetryLabel: {
        ...typography("xxs", "bold"),
        color: Theme.colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    asymmetryValue: {
        ...typography("sm", "bold"),
        color: Theme.colors.text,
    },
    insightRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Theme.spacing.xs,
        marginBottom: Theme.spacing.sm,
    },
    insightChip: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
    },
    insightText: {
        ...typography("xxs", "semibold"),
        color: Theme.colors.text,
    },
    bodyText: {
        ...typography("sm", "regular"),
        lineHeight: 20,
        color: Theme.colors.text,
    },
    staleNotice: {
        ...typography("xxs", "semibold"),
        textAlign: "center",
        marginTop: -Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
        fontStyle: "italic",
    },
    dualColumn: {
        flexDirection: "column",
        gap: Theme.spacing.md,
    },
    dualColumnWide: {
        flexDirection: "row",
    },
    column: {
        flex: 1,
    },
    chartContainer: {
        alignItems: "center",
        marginTop: Theme.spacing.sm,
    },
    chartFallback: {
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.sm,
    },
    plChart: {
        marginVertical: 8,
        borderRadius: Theme.borderRadius.md,
    },
    actionBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: Theme.layout.pagePadding,
        paddingTop: Theme.spacing.sm,
        backgroundColor: Theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.glassBorder,
    },
    actionSummary: {
        marginBottom: Theme.spacing.sm,
    },
    actionLabel: {
        ...typography("xxs", "bold"),
        color: Theme.colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    actionValue: {
        ...typography("sm", "bold"),
        color: Theme.colors.text,
        marginTop: 2,
    },
    actionButton: {
        ...layout.flexRow("center", "center", 8),
        paddingVertical: 14,
        borderRadius: Theme.borderRadius.md,
        ...Theme.shadow,
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        ...typography("base", "bold"),
    },
});
