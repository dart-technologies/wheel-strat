import { runMarathonAgentManual } from "@/reports/agent";
import { getMarketDataProvider } from "@/lib/marketDataProvider";
import { getIbkrFunctionsConfig } from "@/lib/ibkrRuntime";
import { generateMarketReportInternal } from "@/reports/marketReport";
import { notifyMarketScan } from "@/notifications/notifications";

jest.mock("../lib/vertexai", () => {
    return {
        getGenerativeModel: jest.fn(() => ({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ confidence: 85, verdict: "Strong Buy" }) }]
                        }
                    }]
                },
                text: jest.fn(() => JSON.stringify({ confidence: 85, verdict: "Strong Buy" }))
            })
        }))
    };
});

const mockSettingsDoc = {
    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ riskLevel: 'moderate' }) }),
};
const mockOppDoc = {
    get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
    set: jest.fn().mockResolvedValue({}),
};
const mockPredictionHistoryQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
};
const mockCollection = (name: string) => {
    if (name === 'settings') return { doc: () => mockSettingsDoc };
    if (name === 'prediction_history') return mockPredictionHistoryQuery;
    return { doc: () => mockOppDoc };
};

const mockFirestoreInstance = {
    collection: jest.fn().mockImplementation(mockCollection),
    batch: jest.fn().mockReturnValue({
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue({}),
    }),
};

jest.mock("firebase-admin", () => {
    return {
        firestore: Object.assign(() => mockFirestoreInstance, {
            FieldValue: { serverTimestamp: () => 'mock-timestamp' }
        }),
    };
});

jest.mock("firebase-functions/logger");
jest.mock("../lib/marketDataProvider");
jest.mock("../lib/ibkrRuntime");
jest.mock("../reports/marketReport");
jest.mock("../notifications/notifications");

describe("runMarathonAgentManual", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            method: 'POST',
            get: jest.fn().mockReturnValue('test-key'),
            query: {},
            body: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis()
        };

        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeApiKey: "test-key"
        });
    });

    it("requires POST method", async () => {
        mockReq.method = 'GET';
        const wrapped = runMarathonAgentManual as any;
        await wrapped(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(405);
    });

    it("requires valid API key", async () => {
        mockReq.get.mockReturnValue('wrong-key');
        const wrapped = runMarathonAgentManual as any;
        await wrapped(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("successfully runs the agent and generates report", async () => {
        const mockSnapshots = [
            { symbol: 'AAPL', price: 150, ivRank: 60, earningsDate: '2024-05-01' },
            { symbol: 'TSLA', price: 210, ivRank: 20 }
        ];
        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue(mockSnapshots)
        });

        (generateMarketReportInternal as jest.Mock).mockResolvedValue({
            reportId: "rep123",
            reportUrl: "http://report.test"
        });

        const wrapped = runMarathonAgentManual as any;
        await wrapped(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            reportId: "rep123"
        }));

        expect(mockFirestoreInstance.batch).toHaveBeenCalled();
        expect(notifyMarketScan).toHaveBeenCalled();
    });

    it("handles signature plays even if IV Rank is low", async () => {
        const mockSnapshots = [
            { symbol: 'TSLA', price: 190, ivRank: 20 }
        ];
        (getMarketDataProvider as jest.Mock).mockReturnValue({
            getMarketSnapshot: jest.fn().mockResolvedValue(mockSnapshots)
        });

        (generateMarketReportInternal as jest.Mock).mockResolvedValue({ reportId: "rep124" });

        const wrapped = runMarathonAgentManual as any;
        await wrapped(mockReq, mockRes);

        // We can check if generateMarketReportInternal was called with TSLA
        // Note: added 4th arg for reportIdOverride, allowing undefined
        expect(generateMarketReportInternal).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.arrayContaining([expect.objectContaining({ symbol: 'TSLA' })]),
            undefined,
            expect.any(Array)
        );
    });
});
