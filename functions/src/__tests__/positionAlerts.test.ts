import { monitorPositionPrices, updatePositionSnapshots } from '@/portfolio/positionAlerts';
import { getMarketDataProvider } from '@/lib/marketDataProvider';
import { HistoricalRepository } from '@/lib/historicalRepository';
import { isMarketOpen } from '@/lib/time';
import { getIbkrFunctionsConfig } from '@/lib/ibkrRuntime';
import { fetchWithTimeout } from '@/lib/fetch';
import { notifyPositionAlert } from '@/notifications/notifications';

const mockGenerateContent = jest.fn();

jest.mock('../lib/vertexai', () => ({
    getGenerativeModel: jest.fn(() => ({
        generateContent: (...args: any[]) => mockGenerateContent(...args)
    }))
}));

jest.mock('firebase-functions/logger');
jest.mock('../lib/marketDataProvider');
jest.mock('../lib/historicalRepository');
jest.mock('../lib/time');
jest.mock('../lib/ibkrRuntime');
jest.mock('../lib/fetch');
jest.mock('../notifications/notifications');

const mockFirestoreInstance = {
    collection: jest.fn().mockReturnThis(),
    get: jest.fn(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue({}),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    batch: jest.fn().mockReturnValue({
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue({}),
    }),
};

jest.mock('firebase-admin', () => {
    return {
        firestore: Object.assign(() => mockFirestoreInstance, {
            FieldValue: { serverTimestamp: () => 'mock-timestamp' },
            Timestamp: { fromDate: (d: Date) => d }
        }),
    };
});

describe('monitorPositionPrices', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (isMarketOpen as jest.Mock).mockReturnValue(true);
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeUrl: 'http://localhost:5050',
            bridgeApiKey: 'test-key',
            bridgeUrlConfigured: true
        });
        (fetchWithTimeout as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ connected: true })
        });
    });

    it('triggers a price alert when movement exceeds threshold', async () => {
        // Mock Positions
        mockFirestoreInstance.get.mockResolvedValueOnce({
            empty: false,
            docs: [{ data: () => ({ symbol: 'AAPL', previousClose: 100 }) }]
        });

        // Mock No recent alerts (cooldown)
        mockFirestoreInstance.get.mockResolvedValueOnce({ empty: true });
        
        // Mock Existing alert (not found)
        mockFirestoreInstance.get.mockResolvedValueOnce({ exists: false });

        // Mock Market Data
        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue([{ symbol: 'AAPL', price: 105, ivRank: 40 }])
        });

        // Mock RSI
        (HistoricalRepository.prototype.calculateLiveRSI as jest.Mock).mockResolvedValue(50);

        // Mock AI
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [{
                    content: {
                        parts: [{ text: JSON.stringify({ reasoning: 'News catalyst', strategy: 'Covered Call' }) }]
                    }
                }]
            }
        });

        const wrapped = monitorPositionPrices as any;
        await wrapped.run({});

        expect(notifyPositionAlert).toHaveBeenCalledWith('AAPL', 5, 'Covered Call', expect.objectContaining({
            reasoning: 'News catalyst'
        }));
    });

    it('triggers RSI surge alert', async () => {
        mockFirestoreInstance.get.mockResolvedValueOnce({
            empty: false,
            docs: [{ data: () => ({ symbol: 'TSLA', previousClose: 200 }) }]
        });
        mockFirestoreInstance.get.mockResolvedValueOnce({ empty: true });
        mockFirestoreInstance.get.mockResolvedValueOnce({ exists: false });

        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue([{ symbol: 'TSLA', price: 201, ivRank: 30 }])
        });
        (HistoricalRepository.prototype.calculateLiveRSI as jest.Mock).mockResolvedValue(75);

        // Mock AI
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [{
                    content: {
                        parts: [{ text: JSON.stringify({ reasoning: 'Overbought', strategy: 'Hold' }) }]
                    }
                }]
            }
        });

        const wrapped = monitorPositionPrices as any;
        await wrapped.run({});

        expect(notifyPositionAlert).toHaveBeenCalledWith('TSLA', 0, expect.anything(), expect.objectContaining({
            alertType: 'rsi'
        }));
    });

    it('skips when market is closed', async () => {
        (isMarketOpen as jest.Mock).mockReturnValue(false);
        const wrapped = monitorPositionPrices as any;
        await wrapped.run({});
        expect(mockFirestoreInstance.collection).not.toHaveBeenCalled();
    });
});

describe('updatePositionSnapshots onCall', () => {
    it('updates snapshots in batch', async () => {
        const mockRequest = {
            data: {
                positions: [{ symbol: 'AAPL', currentPrice: 155 }]
            }
        };

        const handler = updatePositionSnapshots as any;
        const result = await handler.run(mockRequest);

        expect(result.updated).toBe(1);
        expect(mockFirestoreInstance.batch).toHaveBeenCalled();
    });
});
