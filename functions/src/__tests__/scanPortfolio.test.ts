import * as admin from 'firebase-admin';
// Set environment variable for tests
process.env.IBKR_BRIDGE_URL = 'http://localhost:5050';
process.env.IBKR_BRIDGE_API_KEY = 'test-key';
process.env.MARKET_DATA_PROVIDER = 'live';

// Mocks
jest.mock('firebase-admin', () => {
    const firestore = jest.fn();
    (firestore as any).FieldValue = {
        serverTimestamp: jest.fn(),
    };
    (firestore as any).Timestamp = {
        fromDate: jest.fn((d) => d),
    };
    return { firestore };
});

jest.mock('../lib/vertexai', () => ({
    getGenerativeModel: jest.fn(() => ({
        generateContent: jest.fn().mockResolvedValue({
            response: {
                candidates: [{ content: { parts: [{ text: JSON.stringify({ verdict: "AI Analysis: Good trade.", confidence: 85 }) }] } }]
            }
        })
    }))
}));

jest.mock('https');
jest.mock('http');

import { scanPortfolioHandler } from '@/opportunities/scanPortfolio';

describe('scanPortfolio', () => {
    let firestoreMock: any;
    let batchMock: any;
    let collectionMock: any;

    beforeEach(() => {
        jest.clearAllMocks();

        batchMock = {
            set: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn().mockResolvedValue(true)
        };

        collectionMock = {
            doc: jest.fn(() => ({})),
            get: jest.fn().mockResolvedValue({ docs: [] })
        };

        firestoreMock = {
            batch: jest.fn(() => batchMock),
            collection: jest.fn(() => collectionMock)
        };

        (admin.firestore as any).mockReturnValue(firestoreMock);
    });

    const mockFetch = (urlMap: Record<string, any>) => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
            const urlObj = new URL(url);
            const pat = urlObj.pathname + urlObj.search;
            let body = { error: 'Not found' };
            let statusCode = 404;

            for (const key of Object.keys(urlMap)) {
                if (pat.includes(key)) {
                    body = urlMap[key];
                    statusCode = 200;
                    break;
                }
            }

            if (options?.method === 'POST' && pat.includes('/option-quote')) {
                body = urlMap['/option-quote'] || body;
                statusCode = 200;
            }

            return Promise.resolve({
                ok: statusCode >= 200 && statusCode < 300,
                status: statusCode,
                json: () => Promise.resolve(body),
                text: () => Promise.resolve(JSON.stringify(body))
            });
        });
    };

    // Replace usages of mockHttpsRequest with mockFetch
    (global.fetch as any) = jest.fn();



    it('should return error if bridge is offline', async () => {
        mockFetch({}); // No routes match, returns 404

        await expect(scanPortfolioHandler({ data: { positions: [], cash: 1000 } })).rejects.toThrow();
    });

    it('should find Covered Call opportunities', async () => {
        mockFetch({
            '/health': { connected: true },
            '/market-data/NVDA': { last: 105 },
            '/option-chain/NVDA': {
                expirations: ['20990101', '20990201'],
                strikes: [100, 110, 120]
            },
            '/option-quote': {
                bid: 5.0,
                ask: 5.2,
                delta: 0.3,
                impliedVol: 0.45
            }
        });

        const result = await scanPortfolioHandler({
            data: {
                positions: [{ symbol: 'NVDA', quantity: 100, averageCost: 100, currentPrice: 105 }],
                cash: 10000
            }
        });

        expect(result.opportunities.length).toBeGreaterThan(0);
        expect(result.opportunities[0].strategy).toBe('Covered Call');
        expect(batchMock.commit).toHaveBeenCalled();
    });

    it('should find Cash-Secured Put opportunities', async () => {
        mockFetch({
            '/health': { connected: true },
            '/market-data/TSLA': { last: 200 },
            '/option-chain/TSLA': {
                expirations: ['20990101', '20990201'],
                strikes: [180, 190, 200]
            },
            '/option-quote': {
                bid: 3.0,
                ask: 3.2,
                delta: 0.25,
                impliedVol: 0.50
            }
        });

        // Watchlist includes TSLA by default
        const result = await scanPortfolioHandler({
            data: {
                positions: [],
                cash: 50000,
                watchlist: ['TSLA']
            }
        });

        expect(result.opportunities.length).toBeGreaterThan(0);
        expect(result.opportunities[0].strategy).toBe('Cash-Secured Put');
        expect(result.opportunities[0].symbol).toBe('TSLA');
    });

    it('should skip CSP if insufficient cash', async () => {
        mockFetch({
            '/health': { connected: true },
            '/market-data/TSLA': { last: 200 }, // needs $20,000
        });

        const result = await scanPortfolioHandler({
            data: {
                positions: [],
                cash: 5000, // Not enough
                watchlist: ['TSLA']
            }
        });

        expect(result.opportunities).toHaveLength(0);
    });
});
