import { StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Theme.layout.pagePadding,
        paddingVertical: Theme.spacing.md,
    },
    navButton: {
        padding: Theme.spacing.xs,
    },
    headerTitle: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
    },
    scrollContent: {
        padding: Theme.layout.pagePadding,
        paddingBottom: 100,
    },
    errorText: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        marginBottom: Theme.spacing.md,
    },
    backButton: {
        padding: Theme.spacing.md,
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.borderRadius.sm,
    },
    backButtonText: {
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.bold,
    },
    card: {
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.lg,
    },
    cardContent: {
        padding: Theme.layout.cardPadding,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Theme.spacing.md,
    },
    label: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.primary,
        marginBottom: Theme.spacing.xs,
    },
    bigValue: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.xxl + 4, // 28
        fontWeight: Theme.typography.weights.extraBold,
    },
    badgeContainer: {
        alignItems: 'flex-end',
    },
    badge: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
    },
    badgeSuccess: {
        backgroundColor: Theme.colors.successWash,
    },
    badgeError: {
        backgroundColor: Theme.colors.errorWash,
    },
    badgeText: {
        fontWeight: Theme.typography.weights.bold,
        fontSize: Theme.typography.sizes.sm,
    },
    textSuccess: { color: Theme.colors.profit },
    textError: { color: Theme.colors.loss },

    divider: {
        height: 1,
        backgroundColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.md,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    value: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
    },
    chartContainer: {
        marginBottom: Theme.spacing.xl,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    chartTitle: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
    },
    chartControl: {
        width: '100%',
        marginBottom: Theme.spacing.md,
    },
    chartPlaceholder: {
        height: 200,
        borderRadius: Theme.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
    },
    chartPlaceholderContent: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Theme.spacing.md,
    },
    chartText: {
        color: Theme.colors.textMuted,
        marginTop: Theme.spacing.sm,
    },
    sectionTitle: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.base,
        fontWeight: Theme.typography.weights.bold,
        marginBottom: Theme.spacing.md,
        marginTop: Theme.spacing.sm,
    },
    sectionCard: {
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.lg,
    },
    positionsContent: {
        padding: Theme.layout.cardPadding,
        gap: Theme.spacing.sm,
    },
    positionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.glass,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    positionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        flex: 1,
    },
    positionRight: {
        alignItems: 'flex-end',
    },
    optionActions: {
        flexDirection: 'row',
        gap: Theme.spacing.xs,
        marginTop: Theme.spacing.xs,
    },
    optionActionButton: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    optionActionPrimary: {
        backgroundColor: Theme.colors.glassStrong,
    },
    optionActionSecondary: {
        backgroundColor: Theme.colors.glass,
    },
    optionActionPressed: {
        opacity: 0.7,
    },
    optionActionText: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.xxs,
        fontWeight: Theme.typography.weights.semibold,
    },
    positionTitle: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.semibold,
    },
    positionMeta: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        marginTop: 2,
    },
    positionValue: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.bold,
    },
    positionEmpty: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        paddingVertical: Theme.spacing.sm,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        flex: 1,
    },
    optionGlyph: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    actionCard: {
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.md,
    },
    actionCardDisabled: {
        opacity: 0.75,
    },
    actionCardStale: {
        borderWidth: 1,
        borderColor: Theme.colors.dataStale,
        borderLeftWidth: 3,
        borderLeftColor: Theme.colors.dataStale,
        backgroundColor: Theme.colors.dataStaleWash,
    },
    actionCardContent: {
        padding: Theme.layout.cardPadding,
        gap: Theme.layout.elementGap,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: Theme.borderRadius.xl_lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    actionTitleBlock: {
        flex: 1,
        gap: Theme.spacing.xxs,
    },
    actionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Theme.spacing.sm,
    },
    actionTitle: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.bold,
    },
    actionDesc: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
    },
    actionStaleText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        marginTop: Theme.spacing.xxs,
    },
    actionYieldPill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.md_inner,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    actionYieldMeta: {
        alignItems: 'center',
    },
    actionYieldText: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
    },
    actionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Theme.layout.elementGap,
    },
    actionMeta: {
        flexDirection: 'row',
        gap: Theme.spacing.md_inner,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    metaText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs_lg, // 11
        fontWeight: Theme.typography.weights.primary,
    },
    metaTextItalic: {
        fontStyle: 'italic',
    },
    actionCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.full,
    },
    actionCtaDisabled: {
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    actionCtaText: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
    },
    actionCtaTextMuted: {
        color: Theme.colors.textMuted,
    },
});
