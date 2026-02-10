import { verifyMarathonAgentInternal } from '@/reports/verifyMarathonAgent';
import { getMarketDataProvider } from '@/lib/marketDataProvider';
import { HistoricalRepository } from '@/lib/historicalRepository';

jest.mock('firebase-functions/logger');
jest.mock('../lib/marketDataProvider');
jest.mock('../lib/historicalRepository');

jest.mock('firebase-admin', () => {
    const batchSet = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    const getAll = jest.fn(async (...refs: any[]) => refs.map(ref => ({ id: ref.id, exists: false })));
    const doc = jest.fn((id: string) => ({ id }));
    const where = jest.fn().mockReturnThis();
    const collection = jest.fn(() => ({
        doc,
        where,
        get: jest.fn().mockResolvedValue({
            docs: []
        })
    }));
    const firestore = jest.fn(() => ({
        batch: jest.fn(() => ({ set: batchSet, commit: batchCommit })),
        collection,
        getAll
    }));
    const FieldValue = { serverTimestamp: jest.fn(() => 'mock-timestamp') };
    const Timestamp = { fromDate: jest.fn((d) => ({ toDate: () => d })) };
    (firestore as any).FieldValue = FieldValue;
    (firestore as any).Timestamp = Timestamp;

    return {
        firestore,
        FieldValue,
        Timestamp,
        __mock: { batchSet, batchCommit, getAll, doc, collection, where }
    };
});

const { __mock } = jest.requireMock('firebase-admin') as any;

describe('verifyMarathonAgentInternal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('verifies outcomes for past opportunities', async () => {
        const mockOpps = [
            {
                symbol: 'AAPL',
                strategy: 'Cash-Secured Put',
                strike: 140,
                createdAt: { toDate: () => new Date('2026-01-01') },
                expiration: '20260131'
            }
        ];

        __mock.collection.mockImplementation((name: string) => {
            if (name === 'opportunities') {
                return {
                    where: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue({
                        docs: mockOpps.map(o => ({ id: 'opp1', data: () => o }))
                    })
                };
            }
            return {
                doc: __mock.doc,
                where: __mock.where,
                get: jest.fn().mockResolvedValue({ docs: [] })
            };
        });

        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue([{ symbol: 'AAPL', price: 150 }])
        });

        (HistoricalRepository as jest.Mock).mockImplementation(() => ({
            getHistoricalContext: jest.fn().mockResolvedValue({
                AAPL: { rsi_14: 45, priceHistory: [145, 148, 150] }
            })
        }));

        const result = await verifyMarathonAgentInternal(new Date('2026-02-01'));

        expect(result.processed).toBe(1);
        expect(result.written).toBe(1);
        expect(__mock.batchSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ outcome: 'win', success: true }),
            { merge: true }
        );
    });
});
