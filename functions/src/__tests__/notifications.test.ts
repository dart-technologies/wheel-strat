import { EventEmitter } from "events";
import * as admin from "firebase-admin";
import * as https from "https";

jest.mock("firebase-admin", () => {
    const firestore = jest.fn();
    return { firestore };
});

jest.mock("../lib/ibkrRuntime", () => ({
    getIbkrFunctionsConfig: jest.fn()
}));

jest.mock("https");

import { sendPushNotification, sendTestPush } from "@/notifications/notifications";
import { getIbkrFunctionsConfig } from "@/lib/ibkrRuntime";

type TokenDocData = { token?: string; tokenType?: string };

function mockFirestore(tokens: TokenDocData[], tokenDocs: Array<{ ref: unknown }> = []) {
    const tokensSnapshot = {
        forEach: (fn: (doc: { data: () => TokenDocData }) => void) => {
            tokens.forEach((data) => fn({ data: () => data }));
        }
    };
    const tokenDocsSnapshot = {
        forEach: (fn: (doc: { ref: unknown }) => void) => {
            tokenDocs.forEach((doc) => fn(doc));
        }
    };

    const batchMock = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
    };

    const collectionMock = {
        get: jest.fn().mockResolvedValue(tokensSnapshot),
        where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(tokenDocsSnapshot)
        }))
    };

    const dbMock = {
        collection: jest.fn(() => collectionMock),
        batch: jest.fn(() => batchMock)
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(dbMock);

    return { batchMock, collectionMock };
}

function mockHttpsRequest(handlers: Record<string, { statusCode: number; body: unknown }>) {
    (https.request as jest.Mock).mockImplementation((options: any, callback: any) => {
        const req = new EventEmitter() as any;
        req.write = jest.fn();
        req.end = jest.fn();
        req.destroy = jest.fn();

        process.nextTick(() => {
            const path = options.path || "";
            const handlerKey = Object.keys(handlers).find((key) => path.includes(key));
            const handler = handlerKey ? handlers[handlerKey] : { statusCode: 404, body: { error: "Not found" } };
            const res = new EventEmitter() as any;
            res.statusCode = handler.statusCode;
            callback(res);
            res.emit("data", JSON.stringify(handler.body));
            res.emit("end");
        });

        return req;
    });
}

function makeRes() {
    return {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis()
    };
}

describe("notifications", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getIbkrFunctionsConfig as jest.Mock).mockReturnValue({ bridgeApiKey: "test-key" });
    });

    it("returns 0 when no tokens are registered", async () => {
        mockFirestore([]);

        const result = await sendPushNotification({ title: "Test", body: "Body" });

        expect(result).toBe(0);
        expect(https.request).not.toHaveBeenCalled();
    });

    it("sends to expo tokens and removes invalid tokens", async () => {
        const tokenA = "ExponentPushToken[token-a]";
        const tokenB = "ExpoPushToken[token-b]";
        const tokenDocs = [{ ref: { id: "doc-1" } }];
        const { batchMock, collectionMock } = mockFirestore(
            [
                { token: tokenA, tokenType: "expo" },
                { token: tokenB, tokenType: "expo" },
                { token: "not-expo", tokenType: "expo" }
            ],
            tokenDocs
        );

        mockHttpsRequest({
            "/api/v2/push/send": {
                statusCode: 200,
                body: {
                    data: [
                        { status: "ok", id: "ticket-1" },
                        { status: "ok", id: "ticket-2" }
                    ]
                }
            },
            "/api/v2/push/getReceipts": {
                statusCode: 200,
                body: {
                    data: {
                        "ticket-1": { status: "ok" },
                        "ticket-2": { status: "error", message: "Device not registered", details: { error: "DeviceNotRegistered" } }
                    }
                }
            }
        });

        const result = await sendPushNotification({ title: "Test", body: "Body" });

        expect(result).toBe(2);
        expect(collectionMock.where).toHaveBeenCalledWith("token", "==", tokenB);
        expect(batchMock.delete).toHaveBeenCalledWith(tokenDocs[0].ref);
        expect(batchMock.commit).toHaveBeenCalled();
    });

    it("rejects sendTestPush when unauthorized", async () => {
        const handler = sendTestPush as unknown as (req: any, res: any) => Promise<void>;
        const req = {
            method: "POST",
            query: {},
            body: {},
            get: () => ""
        };
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects sendTestPush for invalid token", async () => {
        const handler = sendTestPush as unknown as (req: any, res: any) => Promise<void>;
        const req = {
            method: "POST",
            query: { token: "InvalidToken" },
            body: {},
            get: () => "test-key"
        };
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns success for sendTestPush without token", async () => {
        mockFirestore([]);

        const handler = sendTestPush as unknown as (req: any, res: any) => Promise<void>;
        const req = {
            method: "POST",
            query: {},
            body: {},
            get: () => "test-key"
        };
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            sentCount: 0,
            targeted: false
        });
    });
});
