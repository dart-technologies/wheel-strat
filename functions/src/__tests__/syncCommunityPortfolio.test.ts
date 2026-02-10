import { syncCommunityPortfolio } from '@/portfolio/syncCommunityPortfolio';
import { fetchWithTimeout } from '@/lib/fetch';
import { getIbkrFunctionsConfig } from '@/lib/ibkrRuntime';
import functionsTest = require('firebase-functions-test');

const test = functionsTest();

jest.mock('firebase-functions/logger');
jest.mock('../lib/fetch');
jest.mock('../lib/ibkrRuntime');
jest.mock('../portfolio/communityPortfolioUtils', () => ({
    buildPositionId: jest.fn((p) => p.symbol),
    normalizeAccountSummary: jest.fn((s) => s),
    normalizePosition: jest.fn((p) => p),
    stripUndefined: jest.fn((o) => o)
}));

jest.mock('firebase-admin', () => {
    const batchSet = jest.fn();
    const batchDelete = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn(() => ({
        set: batchSet,
        delete: batchDelete
    }));
    const collection = jest.fn(() => ({
        doc,
        get: jest.fn().mockResolvedValue({
            docs: []
        })
    }));
    const firestore = jest.fn(() => ({
        batch: jest.fn(() => ({ set: batchSet, delete: batchDelete, commit: batchCommit })),
        collection,
        doc: jest.fn(() => ({ set: batchSet }))
    }));
    const FieldValue = { serverTimestamp: jest.fn(() => 'mock-timestamp') };
    (firestore as any).FieldValue = FieldValue;

    return {
        firestore,
        FieldValue,
        __mock: { batchSet, batchDelete, batchCommit, doc, collection }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;

describe('syncCommunityPortfolio', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeUrl: 'http://localhost:5050',
            bridgeApiKey: 'test-key',
            bridgeUrlConfigured: true
        });
    });

    it('syncs community portfolio for authenticated user', async () => {
        const mockRequest = {
            auth: { uid: 'user123' },
            rawRequest: { headers: {} }
        };

        // Mock Positions Fetch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ positions: [{ symbol: 'AAPL', quantity: 10 }] }),
            text: () => Promise.resolve('ok')
        });

        // Mock Summary Fetch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ cash: 1000000 }),
            text: () => Promise.resolve('ok')
        });

        const wrapped = test.wrap(syncCommunityPortfolio);
        const result = await wrapped(mockRequest as any);

        expect(result.success).toBe(true);
        expect(result.positions).toBe(1);
        expect(__mock.batchCommit).toHaveBeenCalled();
    });
});
