import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { isExpoPushToken, sendExpoPush, type ExpoPushMessage } from "./expoPushClient";

function getDb() {
    return admin.firestore();
}

interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

async function removeInvalidTokens(tokens: string[]) {
    if (tokens.length === 0) return;

    const db = getDb();
    const batch = db.batch();
    for (const token of tokens) {
        const tokenDocs = await db.collection("deviceTokens").where("token", "==", token).get();
        tokenDocs.forEach(doc => batch.delete(doc.ref));
    }
    await batch.commit();
    console.log(`Removed ${tokens.length} invalid Expo tokens`);
}

async function sendPushNotificationToTokens(
    tokens: string[],
    payload: PushPayload,
    label: string
): Promise<number> {
    const uniqueTokens = Array.from(new Set(tokens)).filter(isExpoPushToken);
    if (uniqueTokens.length === 0) {
        console.log(`${label}: no valid Expo push tokens found.`);
        return 0;
    }

    const messages: ExpoPushMessage[] = uniqueTokens.map((token) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: "default",
        priority: "high"
    }));

    const response = await sendExpoPush(messages);
    console.log(`${label}: ${response.successCount} success, ${response.failureCount} failed`);
    if (response.receiptErrors.length > 0) {
        console.warn(`${label}: ${response.receiptErrors.length} receipt errors`, response.receiptErrors);
    }

    await removeInvalidTokens(response.invalidTokens);
    return response.successCount;
}

/**
 * Send push notification to all registered device tokens (Expo Push)
 */
export async function sendPushNotification(payload: PushPayload): Promise<number> {
    const db = getDb();
    const tokensSnapshot = await db.collection("deviceTokens").get();
    const tokens: string[] = [];

    tokensSnapshot.forEach(doc => {
        const data = doc.data() as { token?: string; tokenType?: string };
        if (!data?.token) return;
        if (data.tokenType && data.tokenType !== "expo") return;
        if (!isExpoPushToken(data.token)) return;
        tokens.push(data.token);
    });

    if (tokens.length === 0) {
        console.log("No Expo device tokens registered for push notifications");
        return 0;
    }

    return sendPushNotificationToTokens(tokens, payload, "Push");
}

/**
 * Send notification for a new market scan report
 */
export async function notifyMarketScan(
    reportId: string,
    reportUrl: string,
    session: "open" | "close",
    headline?: string
): Promise<void> {
    const sessionLabel = session === "open" ? "Market Open" : "Market Close";

    await sendPushNotification({
        title: headline ? `📊 ${headline}` : `📊 ${sessionLabel} Scan Ready`,
        body: headline
            ? `Macro outlook + top opportunities ready. Tap to open Strategies.`
            : `New options opportunities identified. Tap to view report.`,
        data: {
            type: 'market_scan',
            reportId,
            reportUrl,
            shareUrl: reportUrl
        }
    });
}

/**
 * Send notification for a position price alert
 */
export async function notifyPositionAlert(
    symbol: string,
    changePercent: number,
    suggestedStrategy: string,
    extraData?: Record<string, string>
): Promise<void> {
    const direction = changePercent > 0 ? '📈' : '📉';
    const changeStr = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`;

    await sendPushNotification({
        title: `${direction} ${symbol} ${changeStr}`,
        body: `Consider ${suggestedStrategy}`,
        data: {
            type: 'position_alert',
            symbol,
            changePercent: changePercent.toString(),
            suggestedStrategy,
            ...(extraData || {})
        }
    });
}

/**
 * Manual test push (secured by API key). Optionally target a specific token.
 */
export const sendTestPush = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST").status(405).send("Method Not Allowed");
        return;
    }

    const { bridgeApiKey } = requireIbkrBridge();
    const providedKey = req.get("X-API-KEY") || req.get("x-api-key") || "";
    if (bridgeApiKey && providedKey !== bridgeApiKey) {
        res.status(401).send("Unauthorized");
        return;
    }

    const tokenValue = typeof req.query.token === "string"
        ? req.query.token
        : typeof req.body?.token === "string"
            ? req.body.token
            : "";
    const title = typeof req.query.title === "string"
        ? req.query.title
        : typeof req.body?.title === "string"
            ? req.body.title
            : "Test push";
    const body = typeof req.query.body === "string"
        ? req.query.body
        : typeof req.body?.body === "string"
            ? req.body.body
            : "This is a test push notification.";

    if (tokenValue && !isExpoPushToken(tokenValue)) {
        res.status(400).json({ error: "Invalid Expo push token" });
        return;
    }

    try {
        const sentCount = tokenValue
            ? await sendPushNotificationToTokens([tokenValue], { title, body }, "Test push")
            : await sendPushNotification({ title, body });
        res.status(200).json({
            success: true,
            sentCount,
            targeted: Boolean(tokenValue)
        });
    } catch (error) {
        console.error("Test push failed:", error);
        res.status(500).json({ error: "Failed to send test push" });
    }
});
