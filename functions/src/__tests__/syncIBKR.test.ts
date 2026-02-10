import { writeExecutions, ingestIbkrExecutions, manualSyncIBKR } from '@/trades/syncIBKR';
import { fetchWithTimeout } from '@/lib/fetch';
import { getIbkrFunctionsConfig } from '@/lib/ibkrRuntime';

jest.mock("firebase-functions/logger");
jest.mock('../lib/fetch');
jest.mock('../lib/ibkrRuntime', () => ({
    getIbkrFunctionsConfig: jest.fn().mockReturnValue({
        bridgeUrl: 'http://localhost:5050',
        bridgeApiKey: 'test-key',
        bridgeUrlConfigured: true
    })
}));
jest.mock('../lib/marketDataProvider', () => ({
    getMarketDataProvider: jest.fn().mockReturnValue({
        getMarketSnapshot: jest.fn().mockResolvedValue([])
    }),
    fetchOptionQuote: jest.fn().mockResolvedValue({ delta: 0.25, theta: -0.02 })
}));
jest.mock('../lib/historicalRepository', () => ({
    HistoricalRepository: jest.fn().mockImplementation(() => ({
        calculateLiveRSI: jest.fn().mockResolvedValue(55)
    }))
}));

jest.mock('firebase-admin', () => {
    const batchSet = jest.fn();
    const batchUpdate = jest.fn();
    const batchDelete = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    const getAll = jest.fn(async (...refs: Array<{ id: string }>) => refs.map((ref) => ({
        id: ref.id,
        exists: false
    })));
    const doc = jest.fn((id: string) => ({ id }));
    const where = jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) }));
    const collection = jest.fn(() => ({ doc, where }));
    const firestore = jest.fn(() => ({
        batch: jest.fn(() => ({ set: batchSet, update: batchUpdate, delete: batchDelete, commit: batchCommit })),
        collection,
        getAll
    }));
    const FieldValue = { serverTimestamp: jest.fn(() => 'mock-timestamp') };
    (firestore as any).FieldValue = FieldValue;

    return {
        firestore,
        FieldValue,
        __mock: { batchSet, batchUpdate, batchDelete, batchCommit, getAll, doc, collection, where }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;
const { batchSet, batchCommit, getAll, collection } = __mock;

describe('writeExecutions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('writes executions to user_trades for community journal', async () => {
        const exec = {
            execId: 'exec1',
            time: '2026-01-01T12:00:00Z',
            symbol: 'AMZN',
            secType: 'OPT',
            side: 'SLD' as const,
            shares: 1,
            price: 1.05,
            avgPrice: 1.05,
            orderRef: 'user-123',
            strike: 210,
            right: 'P',
            expiration: '20260206'
        };

        await writeExecutions([exec]);

        expect(collection).toHaveBeenCalledWith('user_trades');
        expect(getAll).toHaveBeenCalled();
        expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ id: 'exec1' }), expect.objectContaining({
            symbol: 'AMZN',
            type: 'SELL',
            quantity: 1,
            price: 1.05,
            userId: 'user-123',
            raw: exec
        }));
        expect(batchCommit).toHaveBeenCalled();
    });
});

describe('ingestIbkrExecutions webhook', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            method: 'POST',
            get: jest.fn().mockReturnValue('test-key'),
            body: {
                executions: [
                    { execId: 'exec_webhook', symbol: 'AAPL', side: 'BOT', shares: 10, price: 150 }
                ]
            }
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis()
        };
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({ bridgeApiKey: 'test-key' });
    });

    it('processes valid webhook executions', async () => {
        const handler = ingestIbkrExecutions as any;
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            newFills: 0
        }));
    });

    it('rejects invalid API key', async () => {
        mockReq.get.mockReturnValue('wrong-key');
        const handler = ingestIbkrExecutions as any;
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('rejects non-POST method', async () => {
        mockReq.method = 'GET';
        const handler = ingestIbkrExecutions as any;
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(405);
    });
});

describe('manualSyncIBKR onCall', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeUrl: 'http://localhost:5050',
            bridgeApiKey: 'test-key',
            bridgeUrlConfigured: true
        });
    });

    it('syncs trades for authenticated user', async () => {
        const mockRequest = {
            auth: { uid: 'user123' },
            data: { lookbackDays: 7 }
        };

        // Mock Health
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ connected: true, status: 'ok' })
        });

        // Mock Executions
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                executions: [
                    { execId: 'exec_manual', symbol: 'TSLA', side: 'SLD', shares: 5, price: 200, orderRef: 'user123' }
                ]
            })
        });

        // Mock Orders
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                orders: []
            })
        });

        const handler = manualSyncIBKR as any;
        const result = await handler.run(mockRequest);

        expect(result.success).toBe(true);
        expect(result.newFills).toBe(1);
    });

    it('handles bridge health failure', async () => {
        const mockRequest = {
            auth: { uid: 'user123' },
            data: {}
        };

        (fetchWithTimeout as jest.Mock).mockResolvedValue({
            ok: false,
            status: 503
        });

        const handler = manualSyncIBKR as any;
        await expect(handler.run(mockRequest)).rejects.toThrow('Sync failed: Bridge health check failed: 503');
    });

    it('throws unauthenticated error', async () => {
        const mockRequest = {
            auth: null,
            data: {}
        };

        const handler = manualSyncIBKR as any;
        await expect(handler.run(mockRequest)).rejects.toThrow('Must be signed in to sync trades.');
    });
});
