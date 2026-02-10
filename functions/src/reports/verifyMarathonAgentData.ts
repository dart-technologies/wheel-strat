import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import type { OpportunityDoc } from "./verifyMarathonAgentTypes";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = Math.max(1, Number(process.env.PREDICTION_LOOKBACK_WINDOW_DAYS || "1"));

export async function loadOpportunitiesForWindow(
    db: admin.firestore.Firestore,
    targetDate: Date
): Promise<OpportunityDoc[]> {
    const start = new Date(targetDate.getTime() - (WINDOW_DAYS * DAY_MS));
    const end = new Date(targetDate.getTime() + (WINDOW_DAYS * DAY_MS));
    try {
        const snapshot = await db.collection("opportunities")
            .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(start))
            .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(end))
            .get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OpportunityDoc));
    } catch (error) {
        logger.warn("Fallback to recent opportunities list", error);
    }

    const fallback = await db.collection("opportunities")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
    return fallback.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OpportunityDoc));
}
