import { View, Text, ScrollView, StyleSheet, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useReport } from "@/features/reports/hooks";
import { Theme } from "@/constants/theme";
import { Config } from '@/config';
import { Ionicons } from "@expo/vector-icons";
import AnimatedLayout from "@/components/AnimatedLayout";
import { SkeletonCard } from "@/components/Skeleton";
import GlassCard from "@/components/GlassCard";

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { report, loading } = useReport(id);

    const handleShare = async () => {
        if (!report) return;
        const projectId = Config.expo.projectId || 'wheel-strat-app';
        const url = report.reportUrl || `https://${projectId}.web.app/reports/${report.id}`;

        try {
            const headline = report.headline ? `\n${report.headline}` : '';
            await Share.share({
                message: `📊 Market Scan Report - ${report.date} ${report.session === "open" ? "Open" : "Close"}${headline}\n\n${url}`
            });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    const biasColor = report?.marketBias === "bullish" ? Theme.colors.success
        : report?.marketBias === "bearish" ? Theme.colors.error
            : Theme.colors.primary;
    const formatYield = (value?: number | string) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : '--';
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            </SafeAreaView>
        );
    }

    if (!report) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={Theme.colors.textMuted} />
                    <Text style={styles.errorText}>Report not found</Text>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AnimatedLayout delay={100}>
                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => router.back()} style={styles.backIcon}>
                            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
                        </Pressable>
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Market Scan</Text>
                            <View style={styles.meta}>
                                <Text style={styles.metaText}>
                                    {report.date} • {report.session === "open" ? "9:30 AM" : "3:30 PM"}
                                </Text>
                                <View style={[styles.biasBadge, { backgroundColor: biasColor + '22' }]}>
                                    <Text style={[styles.biasText, { color: biasColor }]}>
                                        {report.marketBias.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Pressable onPress={handleShare} style={styles.shareIcon}>
                            <Ionicons name="share-outline" size={24} color={Theme.colors.primary} />
                        </Pressable>
                    </View>

                    {/* Macro Analysis */ }
                    <GlassCard style={styles.section} contentStyle={styles.sectionContent} blurIntensity={Theme.blur.medium}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="globe-outline" size={20} color={Theme.colors.primary} />
                            <Text style={styles.sectionTitle}>Macro Analysis</Text>
                        </View>
                        <Text style={styles.macroText}>{report.macroAnalysis}</Text>
                        {report.vixLevel > 0 && (
                            <Text style={styles.vixLabel}>VIX: {report.vixLevel}</Text>
                        )}
                    </GlassCard>

                    {/* Key Dates */ }
                    {report.keyDates && report.keyDates.length > 0 && (
                        <GlassCard style={styles.section} contentStyle={styles.sectionContent} blurIntensity={Theme.blur.medium}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="calendar-outline" size={20} color={Theme.colors.primary} />
                                <Text style={styles.sectionTitle}>Key Calendar Dates</Text>
                            </View>
                            {report.keyDates.map((date, idx) => (
                                <View key={idx} style={styles.dateRow}>
                                    <View>
                                        <Text style={styles.dateEvent}>{date.event}</Text>
                                        <Text style={styles.dateDate}>{date.date}</Text>
                                    </View>
                                    <Text style={[ 
                                        styles.impactBadge,
                                        date.impact === 'high' && styles.impactHigh,
                                        date.impact === 'medium' && styles.impactMedium
                                    ]}>
                                        {date.impact.toUpperCase()}
                                    </Text>
                                </View>
                            ))}
                        </GlassCard>
                    )}

                    {/* Yield Comparison Table */ }
                    <GlassCard style={styles.section} contentStyle={styles.sectionContent} blurIntensity={Theme.blur.medium}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="trending-up-outline" size={20} color={Theme.colors.primary} />
                            <Text style={styles.sectionTitle}>CC/CSP Yield Comparison</Text>
                        </View>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Symbol</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Strategy</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Strike</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Yield</Text>
                            </View>
                            {report.yieldComparison.map((row, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.symbolCell, { flex: 1 }]}>{row.symbol}</Text>
                                    <Text style={[ 
                                        styles.tableCell,
                                        { flex: 1.5 },
                                        row.strategy === 'Covered Call' ? styles.ccStrategy : styles.cspStrategy
                                    ]}>
                                        {row.strategy === 'Covered Call' ? 'CC' : 'CSP'}
                                    </Text>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>${row.strike}</Text>
                                    <Text style={[styles.tableCell, styles.yieldCell, { flex: 1 }]}>
                                        {formatYield(row.annualizedYield)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </GlassCard>
                </ScrollView>
            </AnimatedLayout>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    content: {
        flex: 1,
        padding: Theme.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.xl,
    },
    backIcon: {
        marginRight: Theme.spacing.md,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: Theme.typography.sizes.xl,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Theme.spacing.xs,
    },
    metaText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    biasBadge: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.md,
        marginLeft: Theme.spacing.sm,
    },
    biasText: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: 'bold',
    },
    shareIcon: {
        marginLeft: Theme.spacing.md,
    },
    section: {
        marginBottom: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.xl,
    },
    sectionContent: {
        padding: Theme.spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
    },
    sectionTitle: {
        color: Theme.colors.primary,
        fontWeight: 'bold',
        fontSize: Theme.typography.sizes.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    macroText: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    vixLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        marginTop: Theme.spacing.md,
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
    table: {
        borderRadius: Theme.borderRadius.md,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.background,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.sm,
    },
    tableHeaderCell: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.glassBorder,
    },
    tableCell: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
    },
    symbolCell: {
        fontWeight: 'bold',
    },
    ccStrategy: {
        color: Theme.colors.strategyCc,
    },
    cspStrategy: {
        color: Theme.colors.strategyCsp,
    },
    yieldCell: {
        color: Theme.colors.success,
        fontWeight: 'bold',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.lg,
        marginTop: Theme.spacing.md,
    },
    backButton: {
        marginTop: Theme.spacing.lg,
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.md,
        backgroundColor: Theme.colors.primary,
        borderRadius: Theme.borderRadius.md,
    },
    backButtonText: {
        color: Theme.colors.white,
        fontWeight: 'bold',
    },
});
