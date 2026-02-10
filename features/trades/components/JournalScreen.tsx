import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Pressable, Text, View, Alert, ActivityIndicator, useWindowDimensions, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { useCell, useRow } from 'tinybase/ui-react';
// import { FlashList } from "@shopify/flash-list";
import ScreenLayout from "@/components/ScreenLayout";
import TradePlaybackModal from "@/features/trades/components/TradePlaybackModal";
import SegmentedControl from "@/components/SegmentedControl";
import BridgeStatus from "@/components/BridgeStatus";
import MarketStatusPill from "@/components/MarketStatusPill";
import FreshnessIndicator from "@/components/FreshnessIndicator";
import GlassCard from "@/components/GlassCard";
import DataTable, { type DataTableColumn, type DataTableRow } from "@/components/DataTable";
import PayoffGlyph from "@/components/PayoffGlyph";
import { Theme } from "@/constants/theme";
import { usePendingOrders, useTradeJournal } from "@/features/trades/hooks";
import { useCommunityTrades } from "@/features/trades/syncHooks";
import { Analytics } from "@/services/analytics";
import { store } from "@/data/store";
import { useAuth } from "@/hooks/useAuth";
import { Trade } from "@wheel-strat/shared";
import { cancelOrder, triggerCommunityPortfolioSync, triggerSync } from "@/services/trading";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { formatCurrency, formatCompactCurrency } from "@/utils/format";
import { getStrategyColor } from '@/utils/strategies';
import { useMinuteTicker } from '@/hooks/useMinuteTicker';
import { styles } from '@/features/trades/components/journal/styles';

// const FList = FlashList as any;

type JournalSortMode = 'date' | 'symbol' | 'total';

export default function JournalScreen() {
    // const listRef = useRef<any>(null);
    const { width } = useWindowDimensions();
    const isIPad = width > 768;
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<'personal' | 'community'>('personal');
    const [sortMode, setSortMode] = useState<JournalSortMode>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    
    useMinuteTicker();

    const lastSyncAtStr = useCell('syncMetadata', 'main', 'lastTradesSync', store);
    const lastSyncAt = lastSyncAtStr ? new Date(String(lastSyncAtStr)) : null;

    const marketStatus = useMarketStatus();

    // Fetch community trades
    const { trades: communityTrades, loading: communityLoading } = useCommunityTrades();

    useEffect(() => {
        Analytics.logScreenView('Journal');
    }, []);

    const handleViewChange = useCallback((idx: number) => {
        const nextMode = idx === 0 ? 'personal' : 'community';
        if (nextMode !== viewMode) {
            Haptics.selectionAsync();
            setViewMode(nextMode);
        }
    }, [viewMode]);

    const { tradeIds } = useTradeJournal();
    const { orderIds } = usePendingOrders();
    const pendingOrderIds = useMemo(() => [...orderIds], [orderIds]);

    const handleTradePress = useCallback((trade: Trade) => {
        Haptics.selectionAsync();
        setSelectedTrade(trade);
    }, []);

    const handleSort = useCallback((key: string) => {
        if (key === sortMode) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMode(key as JournalSortMode);
            setSortDirection('desc');
        }
        Haptics.selectionAsync();
    }, [sortMode]);

    const handleSync = async () => {
        if (!user) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Sign In Required", "Please sign in to sync your IBKR paper trades.");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSyncState('syncing');
        try {
            const result = await triggerSync();
            if (result.error) {
                throw result.error;
            }
            const newFills = result.data?.newFills ?? 0;
            store.setCell('syncMetadata', 'main', 'lastTradesSync', new Date().toISOString());
            setSyncState('success');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            triggerCommunityPortfolioSync()
                .then((syncResult) => {
                    if (syncResult.error) {
                        console.error('Community portfolio sync failed:', syncResult.error);
                    }
                })
                .catch(console.error);
            if (newFills > 0) {
                Alert.alert("Sync Complete", `Found and synced ${newFills} new fills from your IBKR account.`);
                Analytics.logEvent('manual_sync_success', { fills: newFills });
            } else {
                Alert.alert("Sync Complete", "No new fills found since last sync.");
            }
        } catch (e: any) {
            console.error('[Journal] Sync Error:', e);
            setSyncState('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Sync Failed", "Ensure IBKR Bridge is reachable.");
        }
    };

    const columns = useMemo<DataTableColumn[]>(() => {
        const base = [
            { key: 'symbol', label: 'Symbol', flex: 1.5, sortable: true },
            { key: 'total', label: 'Total', align: 'right', flex: 1, sortable: true },
            { key: 'details', label: 'Details', align: 'right', flex: 1.2, sortable: false },
            { key: 'date', label: 'Date', align: 'right', flex: 1, sortable: true },
        ];
        if (isIPad) {
            base.splice(2, 0, { key: 'type', label: 'Type', flex: 0.8, sortable: false });
        }
        return base as DataTableColumn[];
    }, [isIPad]);

    // Helper to resolve action label (Open, Close, etc.)
    const resolveActionLabel = (trade: Trade) => {
        const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, any> : undefined;
        const toUpper = (v?: any) => String(v || '').toUpperCase();
        
        const type = toUpper(trade.type);
        const right = toUpper(trade.right || raw?.right);
        const secType = toUpper(trade.secType || raw?.secType);
        const action = toUpper(raw?.action);
        
        const isOption = secType === 'OPT' || type === 'CC' || type === 'CSP' || !!right;
        
        let label = '';
        const sourceAction = action || type;
        
        if (sourceAction === 'ROLL') label = 'Roll';
        else if (sourceAction === 'CLOSE') label = 'Close';
        else if (sourceAction === 'OPEN') label = 'Open';
        else if (['SELL', 'SLD'].includes(sourceAction)) label = 'Sell';
        else if (['BUY', 'BOT'].includes(sourceAction)) label = 'Buy';
        else label = sourceAction.charAt(0) + sourceAction.slice(1).toLowerCase();

        // Determine strategy suffix
        let strategy = '';
        if (type === 'CC' || right === 'C') strategy = 'CC';
        else if (type === 'CSP' || right === 'P') strategy = 'CSP';

        if (isOption && strategy) {
            return `${label} ${strategy}`;
        }
        return label;
    };

    const allPersonalTrades = useMemo(() => {
        const trades: Trade[] = [];
        tradeIds.forEach(id => {
            const t = store.getRow('trades', id) as unknown as Trade;
            if (t && t.symbol) trades.push({ ...t, id });
        });
        return trades;
    }, [tradeIds]);

    const personalTrades = useMemo(() => {
        if (!user?.uid) return [];
        return allPersonalTrades.filter((trade) => (
            trade.userId === user.uid && trade.orderRef === user.uid
        ));
    }, [allPersonalTrades, user?.uid]);

    const sortedTrades = useMemo(() => {
        const source = viewMode === 'personal' ? personalTrades : communityTrades;
        const sorted = [...source].sort((a, b) => {
            let valA: any, valB: any;
            if (sortMode === 'date') {
                valA = new Date(a.date || 0).getTime();
                valB = new Date(b.date || 0).getTime();
            } else if (sortMode === 'symbol') {
                valA = a.symbol;
                valB = b.symbol;
            } else if (sortMode === 'total') {
                const getVal = (t: Trade) => {
                    const isOpt = (t.type === 'CC' || t.type === 'CSP' || t.secType === 'OPT' || !!t.right || !!t.raw?.right);
                    const m = isOpt ? (Number(t.multiplier) || 100) : 1;
                    return Math.abs(Number(t.price) * Number(t.quantity) * m);
                };
                valA = getVal(a);
                valB = getVal(b);
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [viewMode, personalTrades, communityTrades, sortMode, sortDirection]);

    const rows = useMemo<DataTableRow[]>(() => {
        return sortedTrades.map((trade) => {
            const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, any> : undefined;
            const right = String(trade.right || raw?.right || '').toUpperCase();
            const secType = String(trade.secType || raw?.secType || '').toUpperCase();
            const hasStrike = Number.isFinite(Number(trade.strike ?? raw?.strike))
                && Number(trade.strike ?? raw?.strike) > 0;
            const hasExpiration = Boolean(trade.expiration ?? raw?.expiration ?? raw?.lastTradeDateOrContractMonth);
            const isOption = trade.type === 'CC' || trade.type === 'CSP' || secType === 'OPT' || !!right || hasStrike || hasExpiration;
            const accentColor = getStrategyColor(trade.type === 'CC' || trade.type === 'CSP' ? trade.type : (right === 'C' ? 'CC' : right === 'P' ? 'CSP' : 'BUY'));
            const actionLabel = resolveActionLabel(trade);

            const symbolCell = (
                <View style={styles.symbolCell}>
                    <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
                        {isOption ? (
                            <PayoffGlyph type={trade.type === 'CC' || right === 'C' ? 'cc' : 'csp'} size={14} color="white" />
                        ) : (
                            <Ionicons name="swap-vertical" size={14} color="white" />
                        )}
                    </View>
                    <View>
                        <Text style={styles.tableSymbol}>{trade.symbol}</Text>
                        <Text style={styles.tableAction}>{actionLabel}</Text>
                    </View>
                </View>
            );

            // Calculate total contract value (price * qty * multiplier), with fallback to stored total
            const multiplier = isOption ? (Number(trade.multiplier || raw?.multiplier) || 100) : 1;
            const qty = Number(trade.quantity);
            const rawPrice = Number(trade.price);
            const fallbackPrice = Number(raw?.avgPrice ?? raw?.price);
            const rawTotal = Number(trade.total);
            const resolvedPrice = (Number.isFinite(rawPrice) && rawPrice !== 0)
                ? rawPrice
                : (Number.isFinite(fallbackPrice) ? fallbackPrice : rawPrice);
            const computedTotal = Number.isFinite(resolvedPrice) ? resolvedPrice * qty * multiplier : NaN;
            const displayTotal = Number.isFinite(computedTotal) && computedTotal !== 0
                ? computedTotal
                : (Number.isFinite(rawTotal) ? rawTotal : computedTotal);
            const finalPrice = (Number.isFinite(resolvedPrice) && resolvedPrice !== 0)
                ? resolvedPrice
                : (Number.isFinite(displayTotal) && qty !== 0 ? displayTotal / (qty * multiplier) : resolvedPrice);

            const totalCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tablePrimary, Theme.typography.numeric, displayTotal >= 0 ? styles.textSuccess : styles.textDanger]}>
                        {formatCompactCurrency(displayTotal)}
                    </Text>
                </View>
            );

            const detailsCell = (
                <View style={styles.tableCellRight}>
                    <Text style={[styles.tableSecondary, Theme.typography.numeric]}>
                        {trade.quantity} @ {formatCurrency(finalPrice)}
                    </Text>
                </View>
            );

            const dateCell = (
                <View style={styles.tableCellRight}>
                    <Text style={styles.tableSecondary}>{trade.date}</Text>
                </View>
            );

            const typeCell = (
                <View>
                    <Text style={styles.tableSecondary}>{trade.type}</Text>
                </View>
            );

            const cells: Record<string, React.ReactNode> = {
                symbol: symbolCell,
                total: totalCell,
                details: detailsCell,
                date: dateCell,
            };
            if (isIPad) cells.type = typeCell;

            return {
                key: trade.id || `${trade.symbol}-${trade.date}-${trade.total}`,
                cells,
                onPress: () => handleTradePress(trade),
            };
        });
    }, [sortedTrades, isIPad, handleTradePress]);

    const listHeaderComponent = useMemo(() => (
        <View style={isIPad ? styles.ipadHeader : undefined}>
            <SegmentedControl
                options={['My Trades', 'Community']}
                selectedIndex={viewMode === 'personal' ? 0 : 1}
                onChange={handleViewChange}
                style={styles.viewToggle}
            />

            {viewMode === 'personal' && pendingOrderIds.length > 0 && (
                <View style={styles.pendingSection}>
                    <Text style={styles.pendingTitle}>Pending Orders</Text>
                    {pendingOrderIds.map((id) => (
                        <PendingOrderRow key={id} id={id} />
                    ))}
                </View>
            )}

            <View style={styles.sectionHeader}>
                <Text style={styles.placedTitle}>{viewMode === 'personal' ? 'Placed Trades' : 'Global Activity'}</Text>
            </View>

            {communityLoading && viewMode === 'community' ? (
                <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 20 }} />
            ) : rows.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                        {viewMode === 'personal' ? "No personal trades logged yet." : "The Wall is empty."}
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
                    />
                </View>
            )}
        </View>
    ), [isIPad, viewMode, pendingOrderIds, handleViewChange, communityLoading, rows, columns, handleSort, sortMode, sortDirection]);

    const listPaddingBottom = insets.bottom + (isIPad ? Theme.spacing.lg : Theme.spacing.xxl + Theme.spacing.md);
    const listContentStyle = useMemo(() => ({
        paddingTop: Theme.spacing.lg,
        paddingBottom: listPaddingBottom,
        paddingHorizontal: Theme.spacing.lg,
    }), [listPaddingBottom]);

    return (
        <ScreenLayout
            title="Journal"
            subtitleElement={
                <>
                    <BridgeStatus />
                    <MarketStatusPill isOpen={marketStatus.isOpen} />
                    <View style={styles.marketDetailPill}>
                        <Text style={styles.marketDetailText}>{marketStatus.detailLabel}</Text>
                    </View>
                </>
            }
            delay={200}
            headerContainerStyle={isIPad ? styles.ipadHeader : undefined}
            rightElement={
                <View style={styles.headerRight}>
                    <FreshnessIndicator lastUpdated={lastSyncAt} isRefreshing={syncState === 'syncing'} />
                </View>
            }
        >
            <ScrollView 
                contentContainerStyle={listContentStyle}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={syncState === 'syncing'}
                        onRefresh={handleSync}
                        tintColor={Theme.colors.primary}
                    />
                }
            >
                {listHeaderComponent}
            </ScrollView>

            <TradePlaybackModal
                visible={Boolean(selectedTrade)}
                trade={selectedTrade}
                onClose={() => setSelectedTrade(null)}
            />
        </ScreenLayout>
    );
}

const PendingOrderRow = memo(function PendingOrderRow({ id }: { id: string }) {
    const order = useRow('orders', id, store) as unknown as Trade;
    if (!order || !order.symbol) return null;
    const isCoveredCall = order.type === 'CC';
    const isCashSecuredPut = order.type === 'CSP';
    const glyphType = isCoveredCall ? 'cc' : isCashSecuredPut ? 'csp' : null;

    const handleCancel = () => {
        Alert.alert('Cancel Pending Order', 'Send a cancel request to the IBKR Bridge?', [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Cancel Order',
                style: 'destructive',
                onPress: async () => {
                    const result = await cancelOrder(order);
                    if (result.error) {
                        Alert.alert('Cancel Failed', result.error.message);
                        return;
                    }
                    Alert.alert('Cancel Sent', 'The order cancel request was sent to the bridge.');
                }
            }
        ]);
    };

    return (
        <GlassCard style={styles.pendingCard} contentStyle={styles.pendingCardContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.pendingInfo}>
                <View style={styles.pendingIcon}>
                    {glyphType ? (
                        <PayoffGlyph type={glyphType} size={16} color={Theme.colors.white} />
                    ) : (
                        <Ionicons name="time-outline" size={16} color={Theme.colors.white} />
                    )}
                </View>
                <View>
                    <Text style={styles.pendingSymbol}>{order.symbol}</Text>
                    <Text style={styles.pendingMeta}>{order.type} {order.quantity} @ {formatCurrency(order.price)}</Text>
                </View>
            </View>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
        </GlassCard>
    );
});
