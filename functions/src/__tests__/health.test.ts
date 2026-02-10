import * as admin from "firebase-admin";
import { checkSystemHealth } from "@/system/health";
import { fetchWithTimeout } from "@/lib/fetch";
import { getIbkrFunctionsConfig } from "@/lib/ibkrRuntime";
import { getDB, isDbConfigured } from "@/lib/cloudsql";
import { getGenerativeModel } from "@/lib/vertexai";
import { notifyPositionAlert } from "@/notifications/notifications";
import { Logging } from "@google-cloud/logging";

jest.mock("firebase-admin", () => {
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        add: jest.fn().mockResolvedValue({ id: 'report123' }),
    };
    return {
        firestore: Object.assign(() => mockFirestore, {
            FieldValue: { serverTimestamp: () => 'mock-timestamp' }
        }),
    };
});

jest.mock("firebase-functions/logger");
jest.mock("../lib/fetch");
jest.mock("../lib/ibkrRuntime");
jest.mock("../lib/cloudsql");
jest.mock("../lib/vertexai");
jest.mock("../notifications/notifications");
jest.mock("@google-cloud/logging");

describe("checkSystemHealth", () => {
    let mockLogging: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({
            bridgeUrl: "http://localhost:5050",
            bridgeApiKey: "test-key"
        });

        mockLogging = {
            getEntries: jest.fn().mockResolvedValue([[]])
        };
        (Logging as any).mockImplementation(() => mockLogging);
    });

    it("reports all services as OK when healthy", async () => {
        // Bridge Mock
        (fetchWithTimeout as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ connected: true })
        });

        // DB Mock
        (isDbConfigured as jest.Mock).mockReturnValue(true);
        const mockKnex = { raw: jest.fn().mockResolvedValue({}) };
        (getDB as jest.Mock).mockReturnValue(mockKnex);

        // Gemini Mock
        const mockModel = {
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    candidates: [{ content: { parts: [{ text: "pong" }] } }]
                }
            })
        };
        (getGenerativeModel as jest.Mock).mockReturnValue(mockModel);

        const wrapped = checkSystemHealth as any;
        await wrapped.run({});

        const db = admin.firestore();
        expect(db.collection).toHaveBeenCalledWith("system_health");
        expect(db.collection("system_health").add).toHaveBeenCalledWith(expect.objectContaining({
            criticalFailure: false,
            results: expect.objectContaining({
                bridge: expect.objectContaining({ status: "ok" }),
                database: expect.objectContaining({ status: "ok" }),
                gemini: expect.objectContaining({ status: "ok" })
            })
        }));
    });

    it("alerts when bridge is disconnected", async () => {
        // Bridge Failure
        (fetchWithTimeout as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
            status: 200
        });

        (isDbConfigured as jest.Mock).mockReturnValue(false);

        // Gemini Mock (for AI Analysis)
        const mockModel = {
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "Bridge down", resolution: "Restart it" }) }] } }]
                }
            })
        };
        (getGenerativeModel as jest.Mock).mockReturnValue(mockModel);

        const wrapped = checkSystemHealth as any;
        await wrapped.run({});

        expect(notifyPositionAlert).toHaveBeenCalledWith("SYSTEM", 0, "Outage Detected", expect.anything());
        
        const db = admin.firestore();
        expect(db.collection("system_health").add).toHaveBeenCalledWith(expect.objectContaining({
            criticalFailure: true
        }));
    });

    it("handles database connection errors", async () => {
        (fetchWithTimeout as jest.Mock).mockRejectedValue(new Error("Fetch failed"));
        (isDbConfigured as jest.Mock).mockReturnValue(true);
        (getDB as jest.Mock).mockImplementation(() => {
            throw new Error("DB Connection Error");
        });

        const wrapped = checkSystemHealth as any;
        await wrapped.run({});

        const db = admin.firestore();
        const callArgs = (db.collection("system_health").add as jest.Mock).mock.calls[0][0];
        expect(callArgs.results.database.status).toBe("error");
        expect(callArgs.criticalFailure).toBe(true);
    });
});
