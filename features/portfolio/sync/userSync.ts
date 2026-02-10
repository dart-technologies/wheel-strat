import { useEffect } from 'react';
import { store } from '@/data/store';
import { listenToUserPortfolio, listenToUserPositions } from '@/services/api';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { normalizePortfolio } from './normalize';
import { upsertPositions } from './positions';
import { clearSeedData, SEED_FLAG_KEY } from '@/services/data';

export function useUserPortfolioSync(userId?: string) {
    useEffect(() => {
        if (!userId) {
            return;
        }

        let isActive = true;
        let unsubscribePortfolio: (() => void) | null = null;
        let unsubscribePositions: (() => void) | null = null;

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const maybeResolveSeedData = () => {
            if (store.getValue(SEED_FLAG_KEY) !== true) return;
            const lastPortfolioSync = store.getCell('syncMetadata', 'main', 'lastPortfolioSync');
            const lastPositionsSync = store.getCell('syncMetadata', 'main', 'lastPositionsSync');
            if (lastPortfolioSync && lastPositionsSync) {
                clearSeedData(store, {
                    preservePortfolio: true,
                    preservePositions: true,
                    preserveOptionPositions: true,
                    preserveSyncMetadata: true
                });
            }
        };

        const startListeners = async () => {
            await ensureFirestoreAuthReady();
            if (!isActive) return;

            unsubscribePortfolio = listenToUserPortfolio(userId, (portfolio) => {
                if (portfolio && Object.keys(portfolio).length > 0) {
                    store.setCell('syncMetadata', 'main', 'lastPortfolioSync', new Date().toISOString());
                }
                const normalized = normalizePortfolio(portfolio);
                const existing = store.getRow('portfolio', 'main');
                store.setRow('portfolio', 'main', {
                    ...existing,
                    ...normalized
                });
                maybeResolveSeedData();
            }, (error) => {
                console.error('[useUserPortfolioSync] Error syncing user portfolio:', error);
            });

            unsubscribePositions = listenToUserPositions(userId, async (positions) => {
                let stockSymbols: string[] = [];
                let allSymbols: Set<string> = new Set();

                store.transaction(() => {
                    const existingStocks = store.getTable('positions');
                    const existingOptions = store.getTable('optionPositions');
                    const { nextStockIds, nextOptionIds } = upsertPositions(positions);

                    // Strict sync: Delete anything not in the user's IBKR positions
                    Object.keys(existingStocks).forEach((rowId) => {
                        if (!nextStockIds.has(rowId)) {
                            store.delRow('positions', rowId);
                        }
                    });

                    Object.keys(existingOptions).forEach((rowId) => {
                        if (!nextOptionIds.has(rowId)) {
                            store.delRow('optionPositions', rowId);
                        }
                    });

                    // Collect symbols for market data refresh
                    stockSymbols = Array.from(nextStockIds);

                    // Also collect symbols from options (for option-only positions)
                    const optionTable = store.getTable('optionPositions');
                    Object.values(optionTable).forEach((opt: any) => {
                        if (opt?.symbol) {
                            const symbol = opt.symbol.toUpperCase();
                            allSymbols.add(symbol);

                            // Create placeholder stock position for option-only symbols
                            // This allows market data refresh to populate yields
                            if (!nextStockIds.has(symbol)) {
                                const existing = store.getRow('positions', symbol);
                                if (!existing || Object.keys(existing).length === 0) {
                                    store.setRow('positions', symbol, {
                                        symbol,
                                        quantity: 0,
                                        averageCost: 0,
                                        currentPrice: 0,
                                        costBasis: 0,
                                        marketValue: 0
                                    });
                                }
                            }
                        }
                    });

                    // Add stock symbols
                    stockSymbols.forEach(s => allSymbols.add(s.toUpperCase()));
                });

                store.setCell('syncMetadata', 'main', 'lastPositionsSync', new Date().toISOString());
                maybeResolveSeedData();

                // (reduced verbosity)
                // Debounce market data refresh to prevent redundant calls during rapid Firestore updates
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    const symbolsToRefresh = Array.from(allSymbols);
                    if (symbolsToRefresh.length > 0 && isActive) {
                        const lastRefreshRaw = store.getCell('syncMetadata', 'main', 'lastMarketRefresh');
                        const lastRefreshTime = typeof lastRefreshRaw === 'string'
                            ? Date.parse(lastRefreshRaw)
                            : (typeof lastRefreshRaw === 'number' ? lastRefreshRaw : NaN);
                        if (Number.isFinite(lastRefreshTime) && Date.now() - lastRefreshTime < 15000) {
                            return;
                        }
                        try {
                            const { refreshLiveOptionData } = await import('@/data/marketData');
                            // Use default settings for refresh - will use user's risk profile and DTE window
                            await refreshLiveOptionData(symbolsToRefresh, 70, undefined, undefined, {
                                source: 'positions_sync',
                                logThresholdMs: 3000,
                                skipGreeks: true
                            });
                        } catch (error) {
                            console.error('[useUserPortfolioSync] Market data refresh failed:', error);
                        }
                    }
                }, 2000);
            }, (error) => {
                console.error('[useUserPortfolioSync] Error syncing user positions:', error);
            });
        };

        startListeners();

        return () => {
            isActive = false;
            unsubscribePortfolio?.();
            unsubscribePositions?.();
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [userId]);
}
