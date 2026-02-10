import * as admin from "firebase-admin";
import { notifyPositionAlert } from "@/notifications/notifications";
import { generateAlertContext } from "./positionAlertsAi";
import { suggestStrategy } from "./positionAlertsUtils";

export async function triggerAlert(
    db: admin.firestore.Firestore,
    symbol: string,
    value: number,
    type: "price" | "rsi" | "iv",
    message: string,
    price: number,
    rsi: number,
    iv: number = 0
) {
    const today = new Date().toISOString().split("T")[0];
    const alertId = `${symbol}-${type}-${today}`;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = await db.collection("alerts")
        .where("symbol", "==", symbol)
        .where("createdAt", ">", admin.firestore.Timestamp.fromDate(oneHourAgo))
        .limit(1)
        .get();

    if (!recentAlerts.empty) {
        console.log(`⏳ Cooldown active for ${symbol} (Alerted < 1h ago). Skipping.`);
        return;
    }

    const existingAlert = await db.collection("alerts").doc(alertId).get();
    if (existingAlert.exists) return;

    const fallbackStrategy = suggestStrategy(symbol, type === "price" ? value : 0);
    let reasoning = "Technical movement detected.";
    let strategy = fallbackStrategy;

    const aiContext = await generateAlertContext({
        symbol,
        type,
        message,
        price,
        rsi,
        iv
    });
    if (aiContext) {
        reasoning = aiContext.reasoning;
        strategy = aiContext.strategy;
    }

    await db.collection("alerts").doc(alertId).set({
        symbol,
        type,
        value,
        message,
        suggestedStrategy: strategy,
        reasoning,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        acknowledged: false
    });

    await notifyPositionAlert(
        symbol,
        type === "price" ? value : 0,
        strategy,
        {
            reasoning,
            alertId,
            alertType: type
        }
    );
    console.log(`🚨 ${type.toUpperCase()} Alert: ${symbol} ${message}`);
}
