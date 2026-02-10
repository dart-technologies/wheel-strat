import { getHistoricalBars } from '@/portfolio/historicalData';
import { HistoricalRepository } from '@/lib/historicalRepository';
import functionsTest = require('firebase-functions-test');

const test = functionsTest();

jest.mock('../lib/historicalRepository');
jest.mock('firebase-functions/logger');

describe('getHistoricalBars onCall', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns historical bars for valid symbol', async () => {
        const mockBars = [{ date: '2026-01-01', close: 150 }];
        (HistoricalRepository as jest.Mock).mockImplementation(() => ({
            getHistoricalBars: jest.fn().mockResolvedValue({
                symbol: 'AAPL',
                bars: mockBars,
                source: 'db'
            })
        }));

        const wrapped = test.wrap(getHistoricalBars);
        const result = await wrapped({ data: { symbol: 'AAPL' } } as any);

        expect(result.symbol).toBe('AAPL');
        expect(result.bars).toEqual(mockBars);
    });

    it('throws error if symbol is missing', async () => {
        const wrapped = test.wrap(getHistoricalBars);
        await expect(wrapped({ data: {} } as any)).rejects.toThrow('symbol is required');
    });

    it('throws error if no bars found', async () => {
        (HistoricalRepository as jest.Mock).mockImplementation(() => ({
            getHistoricalBars: jest.fn().mockResolvedValue({
                symbol: 'UNKNOWN',
                bars: []
            })
        }));

        const wrapped = test.wrap(getHistoricalBars);
        await expect(wrapped({ data: { symbol: 'UNKNOWN' } } as any)).rejects.toThrow('No historical data for UNKNOWN');
    });
});
