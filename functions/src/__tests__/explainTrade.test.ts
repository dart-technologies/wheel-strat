
import * as admin from 'firebase-admin';
import functionsTest = require('firebase-functions-test');

const test = functionsTest();

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
                candidates: [{ content: { parts: [{ text: "AI Analysis: Great trade." }] } }]
            },
            text: jest.fn(() => "AI Analysis: Great trade.")
        })
    }))
}));

import { explainTrade } from '@/trades/explainTrade';

describe('explainTrade', () => {
    let firestoreMock: any;
    let docRefMock: any;

    beforeEach(() => {
        jest.clearAllMocks();

        docRefMock = {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(true)
        };

        firestoreMock = {
            collection: jest.fn(() => ({
                doc: jest.fn(() => docRefMock)
            }))
        };

        (admin.firestore as any).mockReturnValue(firestoreMock);
    });

    it('should return cached explanation if fresh', async () => {
        docRefMock.get.mockResolvedValue({
            exists: true,
            data: () => ({
                explanation: 'Cached explanation',
                generatedAt: { toDate: () => new Date() } // Fresh timestamp
            })
        });

        const wrapped = test.wrap(explainTrade);
        const result = await wrapped({
            data: {
                symbol: 'AAPL',
                strategy: 'Covered Call',
                strike: 150,
                expiration: '2026-01-01',
                premium: 5.0
            }
        } as any);

        expect(result.cached).toBe(true);
        expect(result.explanation).toBe('Cached explanation');
        expect(docRefMock.set).not.toHaveBeenCalled();
    });

    it('should generate new explanation if cache missing', async () => {
        docRefMock.get.mockResolvedValue({ exists: false });

        const wrapped = test.wrap(explainTrade);
        const result = await wrapped({
            data: {
                symbol: 'AAPL',
                strategy: 'Covered Call',
                strike: 150,
                expiration: '2026-01-01',
                premium: 5.0
            }
        } as any);

        expect(result.cached).toBe(false);
        expect(result.explanation).toBe('AI Analysis: Great trade.');
        expect(docRefMock.set).toHaveBeenCalled();
    });

    it('should force refresh when requested', async () => {
        // Cache exists
        docRefMock.get.mockResolvedValue({
            exists: true,
            data: () => ({
                explanation: 'Old explanation',
                generatedAt: { toDate: () => new Date() }
            })
        });

        const wrapped = test.wrap(explainTrade);
        const result = await wrapped({
            data: {
                symbol: 'AAPL',
                strategy: 'Covered Call',
                forceRefresh: true
            }
        } as any);

        expect(result.cached).toBe(false);
        expect(docRefMock.set).toHaveBeenCalled();
    });
});
