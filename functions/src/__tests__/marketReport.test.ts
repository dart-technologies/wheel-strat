import * as admin from 'firebase-admin';
import { __test__, generateMarketReportInternal, getMarketReport } from '@/reports/marketReport';
import { HistoricalRepository } from '@/lib/historicalRepository';

const mockGenerateContent = jest.fn();

jest.mock('firebase-admin', () => {
    const mockDoc = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue({}),
        add: jest.fn().mockResolvedValue({}),
    };
    const mockCollection = {
        doc: jest.fn().mockReturnValue(mockDoc),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
    const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection),
        batch: jest.fn().mockReturnValue({
            set: jest.fn(),
            commit: jest.fn().mockResolvedValue({}),
        }),
    };
    return {
        firestore: Object.assign(() => mockFirestore, {
            FieldValue: { serverTimestamp: () => 'mock-timestamp' }
        }),
    };
});

jest.mock('../lib/vertexai', () => ({
    getGenerativeModel: jest.fn(() => ({
        generateContent: (...args: any[]) => mockGenerateContent(...args)
    }))
}));

jest.mock('../lib/historicalRepository');

describe('normalizeReportData', () => {
    it('fills defaults for missing values', () => {
        const data = __test__.normalizeReportData({});

        expect(data.marketBias).toBe('neutral');
        expect(data.keyDates).toEqual([]);
        expect(data.vixLevel).toBe(0);
        expect(data.macroAnalysis).toBe('Market analysis unavailable.');
    });

    it('parses string vix and filters key dates', () => {
        const data = __test__.normalizeReportData({
            macroAnalysis: 'Test',
            vixLevel: '19.4',
            marketBias: 'bullish',
            keyDates: [
                { date: '2026-01-01', event: 'FOMC', impact: 'high', symbols: ['AAPL'] },
                { foo: 'bar' }
            ]
        });

        expect(data.vixLevel).toBeCloseTo(19.4);
        expect(data.marketBias).toBe('bullish');
        expect(data.keyDates).toHaveLength(1);
        expect(data.keyDates[0].event).toBe('FOMC');
    });

    it('normalizes invalid impacts and symbols', () => {
        const data = __test__.normalizeReportData({
            keyDates: [
                { date: '2026-01-01', event: 'Test', impact: 'invalid', symbols: ['AAPL', 1] }
            ]
        });

        expect(data.keyDates[0].impact).toBe('low');
        expect(data.keyDates[0].symbols).toEqual(['AAPL']);
    });
});

describe('generateMarketReportInternal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (HistoricalRepository.prototype.getHistoricalContext as jest.Mock).mockResolvedValue({});
        (HistoricalRepository.prototype.calculateFlashBacktest as jest.Mock).mockResolvedValue({ winRate: 95, maxLoss: 5 });
    });

    it('generates a report with enriched data and AI analysis', async () => {
        mockGenerateContent
            .mockResolvedValueOnce({ // First call for macro analysis
                response: {
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ macroAnalysis: 'Strong growth', marketBias: 'bullish', vixLevel: 15, keyDates: [] }) }]
                        }
                    }]
                },
                text: jest.fn(() => JSON.stringify({ macroAnalysis: 'Strong growth', marketBias: 'bullish', vixLevel: 15, keyDates: [] }))
            })
            .mockResolvedValueOnce({ // Second call for synopsis
                response: {
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ synopsis: 'Summary', analyses: { AAPL: 'News' } }) }]
                        }
                    }]
                },
                text: jest.fn(() => JSON.stringify({ synopsis: 'Summary', analyses: { AAPL: 'News' } }))
            });

        const positions = [{ symbol: 'AAPL', quantity: 100, currentPrice: 150 }];
        const opportunities = [{
            symbol: 'AAPL',
            strategy: 'Covered Call',
            strike: 160,
            expiration: '2026-12-01',
            premium: 2,
            annualizedYield: 15,
            winProb: 80,
            ivRank: 40,
            risk: 'Risk',
            reward: 'Reward'
        }];

        const result = await generateMarketReportInternal('open', positions, opportunities);

        expect(result.reportId).toBeDefined();
        expect(result.reportUrl).toContain(result.reportId);

        const db = admin.firestore();
        expect(db.collection).toHaveBeenCalledWith('reports');
        expect(db.collection('reports').doc).toHaveBeenCalled();
    });
});

describe('getMarketReport HTTP handler', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            path: '/reports/test-report-id',
            method: 'GET'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis()
        };
    });

    it('serves an existing report', async () => {
        const mockData = { html: '<html>Test</html>' };
        const mockDoc = {
            exists: true,
            data: () => mockData
        };
        const db = admin.firestore();
        (db.collection('reports').doc as jest.Mock).mockReturnValue({
            get: jest.fn().mockResolvedValue(mockDoc)
        });

        const handler = getMarketReport as any;
        await handler(mockReq, mockRes);

        expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/html');
        expect(mockRes.send).toHaveBeenCalledWith('<html>Test</html>');
    });

    it('returns 404 if report does not exist', async () => {
        const mockDoc = { exists: false };
        const db = admin.firestore();
        (db.collection('reports').doc as jest.Mock).mockReturnValue({
            get: jest.fn().mockResolvedValue(mockDoc)
        });

        const handler = getMarketReport as any;
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Report Not Found'));
    });

    it('serves latest report if no ID provided', async () => {
        mockReq.path = '/reports/';
        const mockData = { html: '<html>Latest</html>' };
        const mockDoc = {
            id: 'latest-id',
            data: () => mockData
        };
        const db = admin.firestore();
        (db.collection('reports').orderBy as jest.Mock).mockReturnValue({
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
                empty: false,
                docs: [mockDoc]
            })
        });

        const handler = getMarketReport as any;
        await handler(mockReq, mockRes);

        expect(mockRes.send).toHaveBeenCalledWith('<html>Latest</html>');
    });
});
