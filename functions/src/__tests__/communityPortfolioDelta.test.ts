import { getCommunityPortfolioUpdates } from '@/portfolio/communityPortfolioDelta';
import functionsTest = require('firebase-functions-test');

const test = functionsTest();

jest.mock('firebase-functions/logger');

jest.mock('firebase-admin', () => {
    const docMock = {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) })
    };
    const collectionMock = {
        doc: jest.fn(() => docMock),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
            docs: []
        })
    };
    const firestore = jest.fn(() => ({
        collection: jest.fn(() => collectionMock)
    }));
    const FieldPath = {
        documentId: jest.fn(() => 'id')
    };
    (firestore as any).FieldPath = FieldPath;

    return {
        firestore,
        __mock: { firestore, collectionMock, docMock }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;

describe('getCommunityPortfolioUpdates', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns updates since a date', async () => {
        const mockRequest = {
            auth: { uid: 'user123' },
            data: { since: '2026-01-01T00:00:00Z', knownIds: ['stk_AAPL'] }
        };

        __mock.collectionMock.get.mockResolvedValueOnce({
            docs: [{ id: 'stk_TSLA', data: () => ({ symbol: 'TSLA' }) }]
        });
        
        // Mock the "in" query for removed IDs check
        __mock.collectionMock.get.mockResolvedValueOnce({
            docs: [{ id: 'stk_AAPL', data: () => ({}) }]
        });

        const wrapped = test.wrap(getCommunityPortfolioUpdates);
        const result = await wrapped(mockRequest as any);

        expect(result.positions.length).toBe(1);
        expect(result.removedIds.length).toBe(0);
    });

    it('identifies removed IDs', async () => {
        const mockRequest = {
            auth: { uid: 'user123' },
            data: { knownIds: ['stk_AAPL'] }
        };

        __mock.collectionMock.get.mockResolvedValueOnce({ docs: [] }); // positions
        __mock.collectionMock.get.mockResolvedValueOnce({ docs: [] }); // exists check (empty means it was removed)

        const wrapped = test.wrap(getCommunityPortfolioUpdates);
        const result = await wrapped(mockRequest as any);

        expect(result.removedIds).toContain('stk_AAPL');
    });

    it('throws unauthenticated error', async () => {
        const mockRequest = { auth: null, data: {} };
        const wrapped = test.wrap(getCommunityPortfolioUpdates);
        await expect(wrapped(mockRequest as any)).rejects.toThrow('Must be signed in to fetch community updates.');
    });
});
