import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    doc,
    getDoc
} from '@react-native-firebase/firestore';
import { db, httpsCallable } from './firebase';
import { createApiService } from './api.core';

const service = createApiService({
    getDb: () => db,
    httpsCallable,
    firestore: {
        collection,
        doc,
        getDoc,
        getDocs,
        limit,
        onSnapshot,
        orderBy,
        query,
        where
    }
});

export const {
    listenToOpportunities,
    listenToOpportunitySynopsis,
    listenToUserTrades,
    fetchUserTrades,
    listenToUserOrders,
    listenToCommunityTrades,
    fetchOpportunitiesForSymbol,
    fetchRecentOpportunities,
    fetchReportById,
    fetchLatestReport,
    scanPortfolio,
    explainTrade,
    refreshLiveOptions,
    fetchHistoricalBars,
    fetchCommunityPortfolioUpdates,
    syncCommunityPortfolio,
    listenToCommunityPortfolio,
    listenToCommunityPositions,
    syncUserPortfolio,
    listenToUserPortfolio,
    listenToUserPositions,
    fetchLeaderboard,
    fetchLeaderboardCycles,
    listenToMarketCalendar,
    listenToCorporateActions
} = service;

export type { ScanPosition, OpportunityListenerOptions, OpportunityOrderBy } from './api.core';