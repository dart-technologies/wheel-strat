import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, useWindowDimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenLayout from '@/components/ScreenLayout';
import FreshnessIndicator from '@/components/FreshnessIndicator';
import DataTable, { type DataTableColumn, type DataTableRow } from "@/components/DataTable";
import { Theme } from '@/constants/theme';
import { useLeaderboard } from '@/features/leaderboard/hooks';
import { Skeleton } from '@/components/Skeleton';
import GlassCard from '@/components/GlassCard';
import { fetchLeaderboardCycles } from '@/services/api';
import { LeaderboardEntry, isSuccess } from '@wheel-strat/shared';
import { formatPercent } from '@/utils/format';
import { useMinuteTicker } from '@/hooks/useMinuteTicker';
import { styles } from '@/features/leaderboard/components/leaderboard/styles';

type LeaderboardSortMode = 'yield' | 'trades' | 'rank';

const rankColors = {
    1: Theme.colors.strategyCc,
    2: Theme.colors.primary,
    3: Theme.colors.strategyCsp
};

const KEYCAP_RANKS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const getRankKeycap = (rank: number) => KEYCAP_RANKS[rank - 1] || `${rank}`;

export default function LeaderboardScreen() {
    const { width } = useWindowDimensions();
    const isIPad = width > 768;
    const insets = useSafeAreaInsets();
    const { entries, loading, error, refresh, updatedAt } = useLeaderboard();
    const [sortMode, setSortMode] = useState<LeaderboardSortMode>('yield');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    useMinuteTicker();

    const displayName = useCallback((name?: string) => {
        if (!name) return 'Anon';
        return name.includes('@privaterelay.appleid.com') ? 'Anon' : name;
    }, []);

    const openHistory = useCallback(async (entry: LeaderboardEntry) => {
        setSelectedEntry(entry);
        setHistory([]);
        setHistoryError(null);
        setHistoryLoading(true);
        
        try {
            const result = await fetchLeaderboardCycles(entry.userId);
            
            if (!isSuccess(result)) {
                setHistoryError(result.error?.message || 'Failed to load trade history');
                setHistoryLoading(false);
                return;
            }
            
            const cycles = result.data.cycles || [];
            setHistory(cycles);
            setHistoryLoading(false);
        } catch (error: any) {
            console.error('[Leaderboard] Error fetching cycles:', error);
            setHistoryError(error?.message || 'Failed to load trade history');
            setHistoryLoading(false);
        }
    }, []);

    const handleSort = useCallback((key: string) => {
        if (key === sortMode || (key === 'rank' && sortMode === 'yield')) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMode(key as LeaderboardSortMode);
            setSortDirection('desc');
        }
    }, [sortMode]);

    const columns = useMemo<DataTableColumn[]>(() => {
        const base = [
            { key: 'rank', label: '#', flex: 0.6, sortable: true },
            { key: 'trader', label: 'Wheeler', flex: 1.5, sortable: false },
            { key: 'trades', label: 'Trades', align: 'right', flex: 0.8, sortable: true },
            { key: 'yield', label: 'Yield', align: 'right', flex: 1, sortable: true },
        ];
        return base as DataTableColumn[];
    }, []);

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => {
            let valA: any, valB: any;
            if (sortMode === 'yield') {
                valA = a.yieldPct || 0;
                valB = b.yieldPct || 0;
            } else if (sortMode === 'trades') {
                valA = a.tradeCount || 0;
                valB = b.tradeCount || 0;
            } else {
                return 0;
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [entries, sortMode, sortDirection]);

    const rows = useMemo<DataTableRow[]>(() => {
        return sortedEntries.map((entry, index) => {
            const rank = index + 1;
            const highlightColor = rankColors[rank as 1 | 2 | 3] || Theme.colors.glassBorder;

            const rankCell = (
                <View style={styles.rankContainer}>
                    <Text style={rank <= 3 ? styles.rankEmoji : [styles.rankNumberText, { color: highlightColor }]}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : getRankKeycap(rank)}
                    </Text>
                </View>
            );

            const traderCell = (
                <View>
                    <Text style={styles.tableName}>{displayName(entry.displayName)}</Text>
                </View>
            );

            const tradesCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric]}>{entry.tradeCount}</Text>
                </View>
            );

            const yieldCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric, styles.textSuccess]}>
                        {Number.isFinite(entry.yieldPct) ? formatPercent(entry.yieldPct, 1) : '--'}
                    </Text>
                </View>
            );

            return {
                key: entry.userId,
                cells: {
                    rank: rankCell,
                    trader: traderCell,
                    trades: tradesCell,
                    yield: yieldCell,
                },
                onPress: () => openHistory(entry),
            };
        });
    }, [sortedEntries, openHistory, displayName]);

    const renderSkeleton = () => (
        <View style={{ paddingTop: Theme.spacing.md }}>
            {Array.from({ length: 5 }).map((_, index) => (
                <GlassCard key={`skeleton-${index}`} style={styles.skeletonCard} contentStyle={styles.skeletonContent}>
                    <Skeleton width={36} height={36} borderRadius={18} />
                    <View style={styles.skeletonInfo}>
                        <Skeleton width="60%" height={14} />
                        <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                    </View>
                    <View style={styles.skeletonMetric}>
                        <Skeleton width={48} height={12} />
                        <Skeleton width={64} height={16} style={{ marginTop: 6 }} />
                    </View>
                </GlassCard>
            ))}
        </View>
    );

    const listHeaderComponent = useMemo(() => (
        <View style={isIPad ? styles.ipadHeader : undefined}>
            {loading && entries.length === 0 ? (
                renderSkeleton()
            ) : rows.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {error ? 'Leaderboard unavailable.' : 'No data yet.'}
                    </Text>
                </View>
            ) : (
                <View style={styles.tableWrapper}>
                    <DataTable 
                        columns={columns} 
                        rows={rows} 
                        onHeaderPress={handleSort}
                        sortColumn={sortMode}
                        sortDirection={sortDirection}
                        rowPaddingVertical={18}
                    />
                </View>
            )}
        </View>
    ), [loading, entries.length, rows, columns, handleSort, sortMode, sortDirection, error, isIPad]);

    const listPaddingBottom = insets.bottom + (isIPad ? Theme.spacing.lg : Theme.spacing.xxl + Theme.spacing.md);
    const listContentStyle = useMemo(() => ({
        paddingTop: Theme.spacing.lg,
        paddingBottom: listPaddingBottom,
        paddingHorizontal: Theme.spacing.lg,
    }), [listPaddingBottom]);

    return (
        <ScreenLayout
            title="Leaderboard"
            rightElement={(
                <View style={styles.headerRight}>
                    <FreshnessIndicator lastUpdated={updatedAt} isRefreshing={loading} />
                </View>
            )}
            delay={150}
            headerContainerStyle={isIPad ? styles.ipadHeader : undefined}
        >
            <ScrollView 
                contentContainerStyle={listContentStyle}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={() => refresh(true)}
                        tintColor={Theme.colors.primary}
                    />
                }
            >
                {listHeaderComponent}
            </ScrollView>

            <Modal transparent animationType="slide" visible={!!selectedEntry} onRequestClose={() => setSelectedEntry(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Trades</Text>
                                <Text style={styles.modalSubtitle}>{displayName(selectedEntry?.displayName)}</Text>
                            </View>
                            <Pressable onPress={() => setSelectedEntry(null)} style={styles.modalClose}>
                                <Ionicons name="close" size={18} color={Theme.colors.text} />
                            </Pressable>
                        </View>
                        {historyLoading ? (
                            <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: Theme.spacing.md }} />
                        ) : historyError ? (
                            <Text style={styles.errorText}>{historyError}</Text>
                        ) : history.length === 0 ? (
                            <Text style={styles.emptyStateText}>No realized trades found.</Text>
                        ) : (
                            <ScrollView contentContainerStyle={styles.historyList}>
                                {history.map((cycle) => (
                                    <GlassCard key={cycle.id} style={styles.historyCard} contentStyle={styles.historyContent}>
                                        <View>
                                            <Text style={styles.historySymbol}>{cycle.symbol}</Text>
                                            <Text style={styles.historyMeta}>REALIZED · {cycle.date}</Text>
                                        </View>
                                        <View style={styles.historyYield}>
                                            <Text style={styles.historyYieldLabel}>Annualized</Text>
                                            <Text style={styles.historyYieldValue}>
                                                {formatPercent(cycle.yield, 1)}
                                            </Text>
                                        </View>
                                    </GlassCard>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
}

