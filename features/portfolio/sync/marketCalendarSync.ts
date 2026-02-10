import { useEffect } from 'react';
import { listenToMarketCalendar } from '@/services/api';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { syncMarketCalendarRows } from '@/services/calendar';

/**
 * Syncs the market calendar collection into TinyBase.
 */
export function useMarketCalendarSync(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        let isActive = true;
        let unsubscribe: (() => void) | null = null;

        const startListener = async () => {
            await ensureFirestoreAuthReady();
            if (!isActive) return;

            unsubscribe = listenToMarketCalendar((entries) => {
                syncMarketCalendarRows(entries);
            }, (error) => {
                console.error('Error syncing market calendar:', error);
            });
        };

        startListener();

        return () => {
            isActive = false;
            unsubscribe?.();
        };
    }, [enabled]);
}
