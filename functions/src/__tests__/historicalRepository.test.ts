import { HistoricalRepository } from '@/lib/historicalRepository';
import { getDB, isDbConfigured } from '@/lib/cloudsql';

jest.mock('../lib/cloudsql');

const ORIGINAL_ENV = process.env;

describe('HistoricalRepository', () => {
    let repo: HistoricalRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...ORIGINAL_ENV, DB_DISABLE: 'true' };
        repo = new HistoricalRepository();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    describe('getHistoricalContext', () => {
        it('falls back to JSON when DB is disabled', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(false);
            const result = await repo.getHistoricalContext(['NVDA']);

            expect(result.NVDA).toBeDefined();
            expect(result.NVDA.symbol).toBe('NVDA');
            expect(result.NVDA.priceHistory.length).toBeGreaterThan(0);
        });

        it('uses DB when available', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(true);
            const mockKnex = jest.fn().mockImplementation((table) => {
                const query: any = {
                    where: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    first: jest.fn().mockResolvedValue({ rsi_14: 65 }),
                    then: (resolve: any) => resolve([{ close: 100, volume: 1000, date: new Date() }]),
                };
                return query;
            });
            (getDB as jest.Mock).mockReturnValue(mockKnex);

            const result = await repo.getHistoricalContext(['AAPL']);
            expect(result.AAPL).toBeDefined();
            expect(result.AAPL.rsi_14).toBe(65);
        });
    });

    describe('getHistoricalBars', () => {
        it('fetches bars from fallback JSON', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(false);
            const result = await repo.getHistoricalBars('AAPL', { limit: 5 });

            expect(result).not.toBeNull();
            expect(result?.bars.length).toBeLessThanOrEqual(5);
            expect(result?.source).toBe('fallback');
        });

        it('handles date filtering in fallback', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(false);
            // Use June 2025 dates - always within rolling 1Y window
            const result = await repo.getHistoricalBars('AAPL', {
                startDate: '2025-06-01',
                endDate: '2025-06-30'
            });

            expect(result?.bars.length).toBeGreaterThan(0);
            expect(result?.bars.every(b => b.date >= '2025-06-01' && b.date <= '2025-06-30')).toBe(true);
        });
    });

    describe('calculateFlashBacktest', () => {
        it('calculates win rate correctly from fallback data', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(false);
            // AAPL was around 230 in Jan 2025
            const result = await repo.calculateFlashBacktest('AAPL', 230, 200, 5);

            expect(result).not.toBeNull();
            expect(result?.winRate).toBeGreaterThanOrEqual(0);
            expect(result?.winRate).toBeLessThanOrEqual(100);
        });
    });

    describe('calculateLiveRSI', () => {
        it('calculates approximate RSI with current price', async () => {
            (isDbConfigured as jest.Mock).mockReturnValue(false);
            const rsi = await repo.calculateLiveRSI('AAPL', 235);

            expect(rsi).not.toBeNull();
            expect(rsi).toBeGreaterThan(0);
            expect(rsi).toBeLessThan(100);
        });
    });
});
