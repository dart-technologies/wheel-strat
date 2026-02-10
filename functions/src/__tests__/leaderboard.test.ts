import functionsTest = require('firebase-functions-test');

jest.mock('@/trades/leaderboardUtils', () => {
    const actual = jest.requireActual('@/trades/leaderboardUtils');
    return {
        ...actual,
        computeClosedOptionYields: jest.fn((trades: any[]) => (trades.length ? [12] : [])),
    };
});

import { getLeaderboard } from '@/trades/leaderboard';

const test = functionsTest();

jest.mock('firebase-functions/logger');

jest.mock('firebase-admin', () => {
    const docMock = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined)
    };
    const collectionMock = {
        doc: jest.fn(() => docMock),
        get: jest.fn().mockResolvedValue({
            docs: [],
            forEach: (cb: any) => []
        })
    };
    const firestore = jest.fn(() => ({
        collection: jest.fn((name) => {
            if (name === 'user_trades') return collectionMock;
            if (name === 'leaderboards') return collectionMock;
            if (name === 'opportunities') return collectionMock;
            return collectionMock;
        })
    }));
    const auth = jest.fn(() => ({
        getUser: jest.fn().mockResolvedValue({
            displayName: 'Test User',
            email: 'test@example.com'
        })
    }));

    return {
        firestore,
        auth,
        __mock: { firestore, auth, collectionMock, docMock }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;

describe('getLeaderboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns empty leaderboard if no trades found', async () => {
        const wrapped = test.wrap(getLeaderboard);
        const result = await wrapped({ data: {} } as any);

        expect(result.leaderboard).toEqual([]);
    });

    it('computes fresh leaderboard from trades', async () => {
        const mockTrades = [
            {
                userId: 'user1',
                orderRef: 'user1',
                symbol: 'AAPL',
                type: 'SELL',
                side: 'SLD',
                price: 2.50,
                quantity: 1,
                multiplier: 100,
                strike: 150,
                expiration: '20261231',
                date: '2026-01-01',
                secType: 'OPT',
                right: 'P'
            },
            {
                userId: 'user1',
                orderRef: 'user1',
                symbol: 'AAPL',
                type: 'BUY',
                side: 'BOT',
                price: 0.50,
                quantity: 1,
                multiplier: 100,
                strike: 150,
                expiration: '20261231',
                date: '2026-01-05',
                secType: 'OPT',
                right: 'P'
            }
        ];

        __mock.collectionMock.get.mockImplementation(function(this: any) {
            // Check if we are in 'user_trades' or 'opportunities' or 'leaderboards'
            // In the code, it calls db.collection('user_trades').get() first
            // Then it calls db.collection('opportunities').get() for TTOD bot
            return Promise.resolve({
                docs: mockTrades.map(t => ({ data: () => t })),
                forEach: (cb: any) => mockTrades.forEach(t => cb({ data: () => t }))
            });
        });

        const wrapped = test.wrap(getLeaderboard);
        const result = await wrapped({ data: {} } as any);

        expect(result.leaderboard).toBeDefined();
        expect(result.leaderboard!.length).toBeGreaterThan(0);
        expect(result.leaderboard![0].userId).toBe('user1');
    });

    it('serves from cache if valid', async () => {
        const cachedLeaderboard = [
            { userId: 'cached-user', displayName: 'Cached', yieldPct: 50, tradeCount: 10 }
        ];

        __mock.docMock.get.mockResolvedValue({
            exists: true,
            data: () => ({
                updatedAt: Date.now(),
                leaderboard: cachedLeaderboard
            })
        });

        const wrapped = test.wrap(getLeaderboard);
        const result = await wrapped({ data: {} } as any);

        expect(result.leaderboard).toEqual(cachedLeaderboard);
    });

    it('re-computes if cache is expired', async () => {
        const expiredTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago

        __mock.docMock.get.mockResolvedValue({
            exists: true,
            data: () => ({
                updatedAt: expiredTime,
                leaderboard: [{ userId: 'old-user' }]
            })
        });

        // Set up fresh mock data for computation
        __mock.collectionMock.get.mockImplementationOnce(() => Promise.resolve({
            docs: [],
            forEach: (cb: any) => []
        })); // Mock user_trades fetch

        const wrapped = test.wrap(getLeaderboard);
        const result = await wrapped({ data: {} } as any);

        // Should return fresh results (empty in this case as mockTrades is BUY only)
        expect(result.leaderboard).toEqual([]);
        expect(__mock.docMock.set).toHaveBeenCalled();
    });
});
