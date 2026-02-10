import { useEffect } from 'react';
import { store } from '@/data/store';
import { listenToCorporateActions } from '@/services/api';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { applyCorporateActions, syncCorporateActionsRows } from '@/services/corporateActions';
import { toNumber } from './normalize';

/**
 * Syncs corporate actions and applies local adjustments.
 */
export function useCorporateActionsSync(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        let isActive = true;
        let unsubscribe: (() => void) | null = null;

        const startListener = async () => {
            await ensureFirestoreAuthReady();
            if (!isActive) return;

            unsubscribe = listenToCorporateActions((entries) => {
                const actions = entries.map((entry) => ({
                    id: entry.id,
                    symbol: typeof entry.symbol === 'string' ? entry.symbol : '',
                    type: typeof entry.type === 'string' ? entry.type : '',
                    ratio: toNumber(entry.ratio),
                    exDate: typeof entry.exDate === 'string' ? entry.exDate : undefined,
                    effectiveDate: typeof entry.effectiveDate === 'string' ? entry.effectiveDate : undefined,
                    source: typeof entry.source === 'string' ? entry.source : undefined,
                    processedAt: typeof entry.processedAt === 'string' ? entry.processedAt : undefined
                }));
                syncCorporateActionsRows(actions);
                applyCorporateActions(actions);
                store.setCell('syncMetadata', 'main', 'lastCorporateActionsSync', new Date().toISOString());
            }, (error) => {
                console.error('Error syncing corporate actions:', error);
            });
        };

        startListener();

        return () => {
            isActive = false;
            unsubscribe?.();
        };
    }, [enabled]);
}
