import { listenToOpportunities, listenToOpportunitySynopsis } from './api';
import { store } from '@/data/store';
import { syncOpportunities } from '@/services/sync/opportunities';
import { Opportunity } from '@wheel-strat/shared';

/**
 * Service to sync Firestore data to TinyBase
 */
export const startSyncServices = () => {
    // 1. Sync Opportunities
    const unsubscribeOpps = listenToOpportunities(
        { orderByField: 'createdAt', direction: 'desc', limitCount: 50 },
        (opps: Opportunity[]) => {
            // Clear existing or intelligently merge? For simplicity, we sync the latest 50
            syncOpportunities(opps);
        }
    );

    // 2. Sync Synopsis to App Settings
    const unsubscribeSynopsis = listenToOpportunitySynopsis(
        (synopsis) => {
            store.setCell('appSettings', 'main', 'opportunitySynopsis', synopsis);
        }
    );

    return () => {
        unsubscribeOpps();
        unsubscribeSynopsis();
    };
};
