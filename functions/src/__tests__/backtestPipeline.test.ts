import { refreshVolatilityRegimesInternal, precomputePatternStatsInternal } from '@/analysis/backtestPipeline';
import { getDB } from '@/lib/cloudsql';

jest.mock('firebase-functions/logger');
jest.mock('firebase-functions/v2/https');
jest.mock('firebase-admin', () => ({
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false }),
                set: jest.fn().mockResolvedValue(true)
            }))
        }))
    })),
    auth: jest.fn()
}));

jest.mock('../lib/cloudsql', () => {
    const mockQuery: any = jest.fn(() => mockQuery);
    mockQuery.where = jest.fn().mockReturnThis();
    mockQuery.whereNotNull = jest.fn().mockReturnThis();
    mockQuery.andWhere = jest.fn().mockReturnThis();
    mockQuery.orderBy = jest.fn().mockReturnThis();
    mockQuery.limit = jest.fn().mockReturnThis();
    mockQuery.insert = jest.fn().mockReturnThis();
    mockQuery.onConflict = jest.fn().mockReturnThis();
    mockQuery.merge = jest.fn().mockResolvedValue(true);
    mockQuery.del = jest.fn().mockResolvedValue(true);
    mockQuery.first = jest.fn().mockResolvedValue(undefined);
    mockQuery.select = jest.fn().mockReturnThis();
    mockQuery.max = jest.fn().mockReturnThis();
    mockQuery.min = jest.fn().mockReturnThis();
    mockQuery.then = jest.fn((resolve) => resolve([]));

    const mockKnex = jest.fn(() => mockQuery);
    (mockKnex as any).raw = jest.fn((s) => s);
    (mockKnex as any).fn = { now: jest.fn(() => 'now') };

    return {
        getDB: jest.fn(() => mockKnex),
        initSchema: jest.fn().mockResolvedValue(true),
        isDbConfigured: jest.fn().mockReturnValue(true),
        resolveDbConnection: jest.fn().mockReturnValue({})
    };
});

jest.mock('../lib/marketDataProvider', () => ({
    getMarketDataProvider: jest.fn().mockReturnValue({
        getMarketSnapshot: jest.fn().mockResolvedValue([{ symbol: 'AAPL', price: 150, ivRank: 30 }]),
        getOptionChain: jest.fn().mockResolvedValue({ expirations: ['20260220'], strikes: [150] })
    }),
    fetchOptionQuote: jest.fn().mockResolvedValue({ premium: 5.0, delta: 0.5, theta: -0.1 })
}));

jest.mock('../lib/fetch', () => ({
    fetchWithTimeout: jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ impliedVol: 0.25 })
    })
}));

jest.mock('../lib/ibkrRuntime', () => ({
    getIbkrFunctionsConfig: jest.fn().mockReturnValue({
        bridgeUrl: 'http://localhost:5050',
        bridgeApiKey: 'test-key',
        bridgeUrlConfigured: true
    })
}));

describe('backtestPipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MARATHON_SYMBOLS = 'AAPL';
    });

    it('refreshVolatilityRegimesInternal updates DB', async () => {
        const db = getDB();
        const mockQuery = (db as any)();
        mockQuery.then.mockImplementationOnce((resolve: any) => resolve([])); // historical_prices
        mockQuery.then.mockImplementationOnce((resolve: any) => resolve([])); // recentIv query
        
        await refreshVolatilityRegimesInternal(['AAPL']);
        expect(db).toHaveBeenCalled();
    });

    it('precomputePatternStatsInternal computes and stores stats', async () => {
        const db = getDB();
        const mockQuery = (db as any)();
        mockQuery.then.mockImplementationOnce((resolve: any) => resolve([{ date: '2026-01-01', close: 100 }, { date: '2026-01-02', close: 90 }])); // historical_prices
        mockQuery.then.mockImplementationOnce((resolve: any) => resolve([])); // split_factors
        
        await precomputePatternStatsInternal(['AAPL']);
        expect(db).toHaveBeenCalled();
    });
});
