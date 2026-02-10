import { store as defaultStore } from '@/data/store';
import type { Opportunity } from '@wheel-strat/shared';
import type { LiveOptionSnapshot, MarketDataStore, MarketSnapshot } from './types';
import {
    applyLiveOptionMarketData as applyLiveOptionMarketDataCore,
    applyOpportunityMarketData as applyOpportunityMarketDataCore,
    refreshPortfolioNetLiq as refreshPortfolioNetLiqCore
} from './core';

export function refreshPortfolioNetLiq(storeInstance: MarketDataStore = defaultStore) {
    return refreshPortfolioNetLiqCore(storeInstance);
}

export function applyOpportunityMarketData(
    opportunities: Opportunity[],
    storeInstance: MarketDataStore = defaultStore
): MarketSnapshot {
    return applyOpportunityMarketDataCore(opportunities, storeInstance);
}

export function applyLiveOptionMarketData(
    results: LiveOptionSnapshot[],
    storeInstance: MarketDataStore = defaultStore
): MarketSnapshot {
    return applyLiveOptionMarketDataCore(results, storeInstance);
}
