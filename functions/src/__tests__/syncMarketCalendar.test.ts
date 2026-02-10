import { syncMarketCalendarInternal } from '@/calendar/syncMarketCalendar';
import { fetchWithTimeout } from '@/lib/fetch';
import { getMarketDataProvider } from '@/lib/marketDataProvider';
import { refreshMarketHolidaysFromPolygon } from '@/lib/marketCalendar';

jest.mock('firebase-functions/logger');
jest.mock('../lib/fetch');
jest.mock('../lib/marketDataProvider');
jest.mock('../lib/marketCalendar');

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
        collection
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

describe('syncMarketCalendarInternal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.POLYGON_API_KEY = 'test-key';
    });

    it('syncs polygon and macro events', async () => {
        const now = new Date('2026-02-01T00:00:00Z');
        
        // Mock Polygon Fetch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                results: [
                    { date: '2026-02-16', name: "Washington's Birthday", status: 'closed', exchange: 'NYSE' }
                ]
            })
        });

        // Mock Macro events via env
        process.env.MACRO_CALENDAR_EVENTS = JSON.stringify([
            { date: '2026-02-11', event: 'CPI Report', impact: 'high', symbols: ['SPY'] }
        ]);

        // Mock Earnings
        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue([
                { symbol: 'NVDA', earningsDate: '2026-02-21' }
            ])
        });

        const result = await syncMarketCalendarInternal(now);

        expect(result.updated).toBeGreaterThanOrEqual(2);
        expect(__mock.batchSet).toHaveBeenCalled();
        expect(refreshMarketHolidaysFromPolygon).toHaveBeenCalled();
    });

    it('handles fetch failures gracefully', async () => {
        (fetchWithTimeout as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue([])
        });

        const result = await syncMarketCalendarInternal();
        // It might still have 0 if all fail
        expect(typeof result.updated).toBe('number');
    });
});