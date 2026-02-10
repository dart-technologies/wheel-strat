import functionsTest = require('firebase-functions-test');

const test = functionsTest();

jest.mock('firebase-functions/logger');
jest.mock('../lib/fetch');

jest.mock('firebase-admin', () => {
    const batchSet = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn(() => ({
        set: batchSet
    }));
    const collection = jest.fn(() => ({
        doc
    }));
    const firestore = jest.fn(() => ({
        batch: jest.fn(() => ({ set: batchSet, commit: batchCommit })),
        collection
    }));
    (firestore as any).FieldValue = { serverTimestamp: jest.fn(() => 'mock-timestamp') };

    return {
        firestore,
        __mock: { batchSet, batchCommit, doc, collection }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;

describe('syncCorporateActions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, POLYGON_API_KEY: 'test-key' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('syncs splits and dividends from polygon', async () => {
        // We MUST require inside isolateModules because API_KEY is a top-level const
        await jest.isolateModules(async () => {
            const { fetchWithTimeout } = require('../lib/fetch');
            const mockFetch = fetchWithTimeout as jest.Mock;
            const today = new Date().toISOString().split('T')[0];

            mockFetch.mockImplementation(async (url: string) => {
                if (url.includes('splits')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            results: [{ ticker: 'TSLA', execution_date: today, split_from: 1, split_to: 3 }]
                        })
                    };
                }
                if (url.includes('dividends')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            results: [{ ticker: 'AAPL', ex_date: today, cash_amount: 0.25 }]
                        })
                    };
                }
                return { ok: false, status: 404 };
            });

            const { syncCorporateActions } = require('../portfolio/syncCorporateActions');
            const wrapped = test.wrap(syncCorporateActions);
            await wrapped({});

            expect(__mock.batchSet).toHaveBeenCalledTimes(2);
            expect(__mock.batchCommit).toHaveBeenCalled();
        });
    });
});