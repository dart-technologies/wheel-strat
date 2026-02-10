import { refreshLiveOptions } from '@/opportunities/liveMarketData';
import { fetchWithTimeout } from '@/lib/fetch';
import { getIbkrFunctionsConfig } from '@/lib/ibkrRuntime';
import functionsTest = require('firebase-functions-test');

const test = functionsTest();

jest.mock('firebase-functions/logger');
jest.mock('../lib/fetch');
jest.mock('../lib/ibkrRuntime');
jest.mock('../lib/publicMarketData', () => ({
    getPublicMarketConfig: jest.fn().mockReturnValue({ configured: false }),
    PUBLIC_API_SECRET: 'mock-secret'
}));

describe('refreshLiveOptions onCall', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeUrl: 'http://localhost:5050',
            bridgeApiKey: 'test-key',
            bridgeUrlConfigured: true
        });
    });

    it('returns results from IBKR bridge', async () => {
        const mockRequest = {
            data: {
                symbols: ['AAPL'],
                riskLevel: 'Moderate',
                dteWindow: 'four_weeks'
            }
        };

        // Mock Health
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ connected: true })
        });

        // Mock Market Data Batch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                results: [{ symbol: 'AAPL', last: 150 }]
            })
        });

        // Mock Option Chain Batch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                results: [{ symbol: 'AAPL', expirations: ['20260220'], strikes: [140, 150, 160] }]
            })
        });

        // Mock Option Quote Batch
        (fetchWithTimeout as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                results: [
                    { symbol: 'AAPL', expiration: '20260220', right: 'C', strike: 160, bid: 2.0, ask: 2.2, delta: 0.3 },
                    { symbol: 'AAPL', expiration: '20260220', right: 'P', strike: 140, bid: 1.8, ask: 2.0, delta: -0.25 }
                ]
            })
        });

        const wrapped = test.wrap(refreshLiveOptions);
        const result = await wrapped(mockRequest as any);

        expect(result.results.length).toBe(1);
        expect(result.results[0].symbol).toBe('AAPL');
        expect(result.results[0].cc).toBeDefined();
        expect(result.results[0].csp).toBeDefined();
    });
});
