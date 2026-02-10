import { useEffect } from 'react';
import { store } from '@/data/store';
import { fetchCommunityPortfolioUpdates, listenToCommunityPortfolio, listenToCommunityPositions } from '@/services/api';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { normalizePortfolio } from './normalize';
import { removeCommunityPositionById, upsertPositions } from './positions';

export function useCommunityPortfolioSync(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        let isActive = true;
        let unsubscribePortfolio: (() => void) | null = null;
        let unsubscribePositions: (() => void) | null = null;

        const startListeners = async () => {
            await ensureFirestoreAuthReady();
            if (!isActive) return;

            unsubscribePortfolio = listenToCommunityPortfolio((portfolio) => {
                const normalized = normalizePortfolio(portfolio);
                const existing = store.getRow('portfolio', 'main');
                store.setRow('portfolio', 'main', {
                    ...existing,
                    ...normalized
                });
            }, (error) => {
                console.error('Error syncing community portfolio:', error);
            });

            unsubscribePositions = listenToCommunityPositions((positions) => {
                store.transaction(() => {
                    const existingStocks = store.getTable('positions');
                    const existingOptions = store.getTable('optionPositions');
                    const { nextStockIds, nextOptionIds } = upsertPositions(positions);

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
                });
            }, (error) => {
                console.error('Error syncing community positions:', error);
            });
        };

        startListeners();

        return () => {
            isActive = false;
            unsubscribePortfolio?.();
            unsubscribePositions?.();
        };
    }, [enabled]);
}

/**
 * Delta sync for community portfolio (fallback when listeners lag).
 */
export function useCommunityPortfolioDeltaSync(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        let isActive = true;

        const runDeltaSync = async () => {
            await ensureFirestoreAuthReady();
            if (!isActive) return;

            const sinceValue = store.getCell('syncMetadata', 'main', 'lastCommunitySync');
            const since = typeof sinceValue === 'string' ? sinceValue : undefined;
            const knownIds = [
                ...store.getRowIds('positions').map((id) => `stk_${id}`),
                ...store.getRowIds('optionPositions')
            ];

            const result = await fetchCommunityPortfolioUpdates(since, knownIds);
            if (result.error) {
                console.error('Community delta sync failed:', result.error);
                return;
            }

            const payload = result.data;
            store.transaction(() => {
                if (payload?.portfolio) {
                    const normalized = normalizePortfolio(payload.portfolio);
                    const existing = store.getRow('portfolio', 'main');
                    store.setRow('portfolio', 'main', {
                        ...existing,
                        ...normalized
                    });
                }

                if (Array.isArray(payload?.positions)) {
                    upsertPositions(payload.positions);
                }

                if (Array.isArray(payload?.removedIds)) {
                    payload.removedIds.forEach((id) => removeCommunityPositionById(id));
                }
            });

            store.setCell('syncMetadata', 'main', 'lastCommunitySync', payload?.updatedAt || new Date().toISOString());
        };

        runDeltaSync();

        return () => {
            isActive = false;
        };
    }, [enabled]);
}
