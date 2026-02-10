import { Result, success, failure } from '@wheel-strat/shared';
import {
    ExplainTradeRequest,
    ExplainTradeResponse,
    DteWindow,
    TraderLevel,
    RiskLevel,
    ReportData,
    Opportunity,
    Trade,
    ScanPosition,
    OpportunityListenerOptions,
    OpportunityOrderBy,
    LeaderboardResponse
} from '@wheel-strat/shared';
import { snapshotToList, snapshotToListWithId, docExists } from './firestoreHelpers';

export type { ScanPosition, OpportunityListenerOptions, OpportunityOrderBy };

type FirestoreAdapter = {
    collection: (...args: any[]) => any;
    doc: (...args: any[]) => any;
    getDoc: (...args: any[]) => Promise<any>;
    getDocs: (...args: any[]) => Promise<any>;
    limit: (...args: any[]) => any;
    onSnapshot: (...args: any[]) => any;
    orderBy: (...args: any[]) => any;
    query: (...args: any[]) => any;
    where: (...args: any[]) => any;
};

type HttpsCallable = <Req, Res>(name: string, options?: { timeout: number }) => (data: Req) => Promise<{ data: Res } | any>;

type ApiDeps = {
    getDb: () => any;
    firestore: FirestoreAdapter;
    httpsCallable: HttpsCallable;
};

type CommunityPosition = {
    symbol?: string;
    quantity?: number;
    averageCost?: number;
    currentPrice?: number;
    closePrice?: number;
    costBasis?: number;
    marketValue?: number;
    dailyPnl?: number;
    dailyPnlPct?: number;
    ivRank?: number;
    rsi?: number;
    beta?: number;
    delta?: number;
    theta?: number;
    gamma?: number;
    vega?: number;
    companyName?: string;
    secType?: string;
    right?: string;
    strike?: number;
    expiration?: string;
    multiplier?: number;
    localSymbol?: string;
    conId?: number;
    [key: string]: unknown;
};

export const createApiService = ({ getDb, firestore, httpsCallable }: ApiDeps) => {
    const callFunction = async <Req, Res>(name: string, data: Req): Promise<Result<Res>> => {
        const callable = httpsCallable<Req, Res>(name, { timeout: 600000 });
        try {
            const result = await callable(data);
            return success(result.data);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const buildOpportunitiesQuery = ({
        orderByField = 'createdAt',
        direction = 'desc',
        limitCount = 20
    }: OpportunityListenerOptions) => {
        const db = getDb();
        return firestore.query(
            firestore.collection(db, 'opportunities'),
            firestore.orderBy(orderByField, direction),
            firestore.limit(limitCount)
        );
    };

    const listenToOpportunities = (
        options: OpportunityListenerOptions = {},
        onData: (opportunities: Opportunity[]) => void,
        onError?: (error: Error) => void
    ) => {
        const q = buildOpportunitiesQuery(options);

        return firestore.onSnapshot(
            q,
            (snapshot: any) => {
                onData(snapshotToList<Opportunity>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToOpportunitySynopsis = (
        onData: (synopsis: string) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.doc(db, 'opportunities', 'metadata');
        return firestore.onSnapshot(
            ref,
            (docSnap: any) => {
                if (!docExists(docSnap)) {
                    onData('');
                    return;
                }
                const summary = docSnap.data()?.summary;
                onData(typeof summary === 'string' ? summary : '');
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToUserTrades = (
        userId: string,
        onChange: (trade: Trade, id: string) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'user_trades'),
            firestore.where('userId', '==', userId),
            firestore.orderBy('date', 'desc'),
            firestore.limit(100)
        );

        return firestore.onSnapshot(
            q,
            (snapshot: any) => {
                snapshot.docChanges().forEach((change: any) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        onChange(change.doc.data() as Trade, change.doc.id);
                    }
                });
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const fetchUserTrades = async (userId: string, limitCount = 100): Promise<Result<Trade[]>> => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'user_trades'),
            firestore.where('userId', '==', userId),
            firestore.orderBy('date', 'desc'),
            firestore.limit(limitCount)
        );
        try {
            const snapshot = await firestore.getDocs(q);
            const data = snapshot.docs.map((docSnap: any) => ({ ...(docSnap.data() as Trade), id: docSnap.id }));
            return success(data);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const listenToUserOrders = (
        userId: string,
        onData: (orders: Trade[]) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'user_orders'),
            firestore.where('userId', '==', userId),
            firestore.orderBy('updatedAt', 'desc'),
            firestore.limit(100)
        );

        return firestore.onSnapshot(
            q,
            (snapshot: any) => {
                onData(snapshotToListWithId<Trade>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToCommunityTrades = (
        limitCount = 50,
        onData: (trades: Trade[]) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'user_trades'),
            firestore.orderBy('date', 'desc'),
            firestore.limit(limitCount)
        );

        return firestore.onSnapshot(
            q,
            (snapshot: any) => {
                onData(snapshotToListWithId<Trade>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const fetchOpportunitiesForSymbol = async (symbol: string): Promise<Result<Opportunity[]>> => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'opportunities'),
            firestore.where('symbol', '==', symbol)
        );
        try {
            const snapshot = await firestore.getDocs(q);
            const data = snapshot.docs.map((docSnap: any) => docSnap.data() as Opportunity);
            return success(data);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const fetchRecentOpportunities = async (
        options: OpportunityListenerOptions = {}
    ): Promise<Result<Opportunity[]>> => {
        const q = buildOpportunitiesQuery(options);
        try {
            const snapshot = await firestore.getDocs(q);
            const data = snapshot.docs.map((docSnap: any) => docSnap.data() as Opportunity);
            return success(data);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const fetchReportById = async (id: string): Promise<Result<ReportData>> => {
        const db = getDb();
        const docRef = firestore.doc(db, 'reports', id);
        try {
            const docSnap = await firestore.getDoc(docRef);
            if (!docExists(docSnap)) {
                return failure(new Error(`Report ${id} not found`));
            }
            return success({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as ReportData);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const fetchLatestReport = async (): Promise<Result<ReportData>> => {
        const db = getDb();
        const q = firestore.query(
            firestore.collection(db, 'reports'),
            firestore.orderBy('createdAt', 'desc'),
            firestore.limit(1)
        );
        try {
            const snapshot = await firestore.getDocs(q);
            if (snapshot.empty) {
                return failure(new Error('No reports found'));
            }
            const docSnap = snapshot.docs[0];
            return success({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as ReportData);
        } catch (e) {
            return failure(e instanceof Error ? e : new Error(String(e)));
        }
    };

    const scanPortfolio = async (
        positions: ScanPosition[],
        cash: number,
        settings?: {
            riskLevel?: RiskLevel;
            traderLevel?: TraderLevel;
            dteWindow?: DteWindow;
        }
    ): Promise<Result<void>> => callFunction('scanPortfolio', { positions, cash, ...settings });

    const explainTrade = async (request: ExplainTradeRequest): Promise<Result<ExplainTradeResponse>> => (
        callFunction<ExplainTradeRequest, ExplainTradeResponse>('explainTrade', request)
    );

    const refreshLiveOptions = async (
        symbols: string[],
        targetWinProb = 70,
        dteWindow?: DteWindow,
        options?: { skipGreeks?: boolean }
    ): Promise<Result<any>> => callFunction('refreshLiveOptions', {
        symbols,
        targetWinProb,
        dteWindow,
        ...(options?.skipGreeks ? { skipGreeks: true } : {})
    });

    const fetchHistoricalBars = async (
        symbol: string,
        options?: { limit?: number; startDate?: string; endDate?: string }
    ): Promise<Result<any>> => callFunction('getHistoricalBars', { symbol, ...options });

    const fetchCommunityPortfolioUpdates = async (
        since?: string,
        knownIds?: string[]
    ): Promise<Result<{ updatedAt: string; positions: Array<CommunityPosition & { id: string }>; removedIds: string[]; portfolio: Record<string, unknown> }>> => (
        callFunction('getCommunityPortfolioUpdates', { since, knownIds })
    );

    const syncCommunityPortfolio = async (): Promise<Result<{ success: boolean; positions: number; removed: number; updatedAt: string }>> => (
        callFunction('syncCommunityPortfolio', {} as Record<string, never>)
    );

    const listenToCommunityPortfolio = (
        onData: (portfolio: Record<string, unknown>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.doc(db, 'community_portfolio', 'main');
        return firestore.onSnapshot(
            ref,
            (snapshot: any) => {
                onData(docExists(snapshot) ? (snapshot.data() as Record<string, unknown>) : {});
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToUserPortfolio = (
        userId: string,
        onData: (portfolio: Record<string, unknown>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.doc(db, 'user_portfolio', userId);
        
        return firestore.onSnapshot(
            ref,
            (snapshot: any) => {
                const exists = docExists(snapshot);
                const data = exists ? (snapshot.data() as Record<string, unknown>) : {};
                onData(data);
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToUserPositions = (
        userId: string,
        onData: (positions: Array<CommunityPosition & { id: string }>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const col = firestore.collection(db, 'user_positions');
        const q = firestore.query(col, firestore.where('userId', '==', userId));
        
        return firestore.onSnapshot(
            q,
            (snapshot: any) => {
                const positions = snapshotToListWithId<CommunityPosition & { id: string }>(snapshot);
                onData(positions);
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const syncUserPortfolio = async (): Promise<Result<{ success: boolean; positions: number; removed: number; updatedAt: string }>> => (
        callFunction('syncUserPortfolio', {} as Record<string, never>)
    );

    const listenToCommunityPositions = (
        onData: (positions: Array<CommunityPosition & { id: string }>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.collection(db, 'community_positions');
        return firestore.onSnapshot(
            ref,
            (snapshot: any) => {
                onData(snapshotToListWithId<CommunityPosition & { id: string }>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const fetchLeaderboard = async (force = false): Promise<Result<LeaderboardResponse>> => (
        callFunction('getLeaderboard', { force })
    );

    const fetchLeaderboardCycles = async (userId: string): Promise<Result<{ cycles: any[] }>> => (
        callFunction('getLeaderboard', { userId })
    );

    const listenToMarketCalendar = (
        onData: (entries: Array<Record<string, unknown> & { id: string }>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.collection(db, 'market_calendar');
        return firestore.onSnapshot(
            ref,
            (snapshot: any) => {
                onData(snapshotToListWithId<Record<string, unknown> & { id: string }>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    const listenToCorporateActions = (
        onData: (entries: Array<Record<string, unknown> & { id: string }>) => void,
        onError?: (error: Error) => void
    ) => {
        const db = getDb();
        const ref = firestore.collection(db, 'corporate_actions');
        return firestore.onSnapshot(
            ref,
            (snapshot: any) => {
                onData(snapshotToListWithId<Record<string, unknown> & { id: string }>(snapshot));
            },
            (error: any) => {
                onError?.(error as Error);
            }
        );
    };

    return {
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
    };
};
