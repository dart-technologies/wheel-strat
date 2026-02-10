import { useEffect, useState } from 'react';
import { listenToUserTrades, listenToCommunityTrades, listenToUserOrders } from '@/services/api';
import { Trade } from '@wheel-strat/shared';
import { syncTradeFromBridge } from '@/services/trades';
import { getPendingOrderIntentIds, syncOrdersFromFirestore } from '@/services/orders';
import { triggerSync } from '@/services/trading';

/**
 * Syncs personal trades from Firestore to local TinyBase store.
 */
export function useUserTradeSync(uid?: string) {
    useEffect(() => {
        if (!uid) return;

        const unsubscribe = listenToUserTrades(
            uid,
            (tradeData, id) => {
                syncTradeFromBridge({ ...tradeData, id }, { updatePositions: false });
            },
            (error) => {
                console.error('Error syncing user trades:', error);
            }
        );

        return () => unsubscribe();
    }, [uid]);
}

/**
 * Syncs pending orders from Firestore to local TinyBase store.
 */
export function useUserOrderSync(uid?: string) {
    useEffect(() => {
        if (!uid) return;

        const pendingIntents = getPendingOrderIntentIds();
        if (pendingIntents.length > 0) {
            triggerSync({ lookbackDays: 2 }).catch((error) => {
                console.error('Pending intent reconciliation failed:', error);
            });
        }

        const unsubscribe = listenToUserOrders(
            uid,
            (orders) => {
                syncOrdersFromFirestore(orders);
            },
            (error) => {
                console.error('Error syncing user orders:', error);
            }
        );

        return () => unsubscribe();
    }, [uid]);
}

/**
 * Returns a list of all recent trades from the community ledger.
 */
export function useCommunityTrades(limitCount = 50) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = listenToCommunityTrades(
            limitCount,
            (list) => {
                setTrades(list);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching community trades:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [limitCount]);

    return { trades, loading };
}
