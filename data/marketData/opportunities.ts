import { fetchRecentOpportunities } from '@/services/api';
import { applyOpportunityMarketData } from './store';
import type { MarketDataStore, MarketRefreshOptions } from './types';

export async function refreshMarketData(
    options: MarketRefreshOptions = {},
    storeInstance?: MarketDataStore
) {
    const result = await fetchRecentOpportunities(options);
    if (result.error) {
        throw result.error;
    }
    const opportunities = result.data;
    const snapshot = storeInstance
        ? applyOpportunityMarketData(opportunities, storeInstance)
        : applyOpportunityMarketData(opportunities);
    return { opportunities, ...snapshot };
}
