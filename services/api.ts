import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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
    syncUserPortfolio,
    listenToUserPortfolio,
    listenToUserPositions,
    listenToCommunityPositions,
    fetchLeaderboard,
    fetchLeaderboardCycles,
    listenToMarketCalendar,
    listenToCorporateActions
} = service;

export type { ScanPosition, OpportunityListenerOptions, OpportunityOrderBy } from './api.core';