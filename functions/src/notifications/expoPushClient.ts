import * as https from "https";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_CHUNK_SIZE = 100;

export interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    sound?: "default";
    priority?: "default" | "high";
}

interface ExpoTicket {
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: {
        error?: string;
    };
}

interface ExpoReceipt {
    status: "ok" | "error";
    message?: string;
    details?: {
        error?: string;
    };
}

export function isExpoPushToken(token: string) {
    return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

const chunkArray = <T,>(items: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const postJson = <T,>(url: string, body: unknown, timeout = 10000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const data = JSON.stringify(body);
        const req = https.request(
            {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(data),
                    ...(process.env.EXPO_ACCESS_TOKEN
                        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
                        : {})
                },
                timeout
            },
            (res) => {
                let payload = "";
                res.on("data", chunk => payload += chunk);
                res.on("end", () => {
                    const statusCode = res.statusCode || 0;
                    if (statusCode < 200 || statusCode >= 300) {
                        const error = new Error(`Request failed with status ${statusCode}`);
                        (error as { statusCode?: number; body?: string }).statusCode = statusCode;
                        (error as { statusCode?: number; body?: string }).body = payload;
                        reject(error);
                        return;
                    }
                    try {
                        resolve(JSON.parse(payload));
                    } catch (error) {
                        const parseError = new Error("Failed to parse JSON response");
                        (parseError as { body?: string }).body = payload;
                        reject(parseError);
                    }
                });
            }
        );

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });

        req.write(data);
        req.end();
    });
};

export async function sendExpoPush(messages: ExpoPushMessage[]) {
    const chunks = chunkArray(messages, EXPO_CHUNK_SIZE);
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = new Set<string>();
    const ticketTokenMap = new Map<string, string>();
    const ticketIds: string[] = [];

    for (const chunk of chunks) {
        try {
            const response = await postJson<{ data?: ExpoTicket[] }>(EXPO_PUSH_URL, chunk);
            const tickets = Array.isArray(response.data) ? response.data : [];
            if (tickets.length === 0) {
                failureCount += chunk.length;
                console.warn("Expo push returned no tickets for chunk.");
                continue;
            }
            tickets.forEach((ticket, idx) => {
                const token = chunk[idx]?.to;
                if (ticket.status === "ok") {
                    successCount += 1;
                    if (ticket.id && token) {
                        ticketIds.push(ticket.id);
                        ticketTokenMap.set(ticket.id, token);
                    }
                } else {
                    failureCount += 1;
                    if (ticket.details?.error === "DeviceNotRegistered" && token) {
                        invalidTokens.add(token);
                    }
                }
            });
        } catch (error) {
            failureCount += chunk.length;
            console.error("Expo push send failed:", error);
        }
    }

    const receiptErrors: Array<{ id: string; error: string; message?: string }> = [];
    if (ticketIds.length > 0) {
        const receiptChunks = chunkArray(ticketIds, EXPO_CHUNK_SIZE);
        for (const receiptChunk of receiptChunks) {
            try {
                const response = await postJson<{ data?: Record<string, ExpoReceipt> }>(
                    EXPO_RECEIPTS_URL,
                    { ids: receiptChunk }
                );
                const receipts = response.data || {};
                receiptChunk.forEach((id) => {
                    const receipt = receipts[id];
                    if (!receipt) {
                        receiptErrors.push({ id, error: "MissingReceipt" });
                        return;
                    }
                    if (receipt.status === "error") {
                        const errorCode = receipt.details?.error || "UnknownError";
                        receiptErrors.push({ id, error: errorCode, message: receipt.message });
                        const token = ticketTokenMap.get(id);
                        if (errorCode === "DeviceNotRegistered" && token) {
                            invalidTokens.add(token);
                        }
                    }
                });
            } catch (error) {
                console.error("Expo receipt fetch failed:", error);
                receiptChunk.forEach((id) => {
                    receiptErrors.push({ id, error: "ReceiptFetchFailed" });
                });
            }
        }
    }

    return {
        successCount,
        failureCount,
        invalidTokens: Array.from(invalidTokens),
        receiptErrors
    };
}
