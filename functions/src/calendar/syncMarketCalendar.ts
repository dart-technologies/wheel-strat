import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { buildDocId, DAY_MS, isValidDate, mergeEvents } from "./marketCalendarUtils";
import { loadEarningsEvents, loadMacroEvents, loadPolygonEvents } from "./marketCalendarSources";

const DEFAULT_WINDOW_DAYS = 30;

export async function syncMarketCalendarInternal(now = new Date()) {
    const apiKey = process.env.POLYGON_API_KEY || process.env.EXPO_PUBLIC_POLYGON_API_KEY;
    const windowDays = Math.max(7, Math.min(120, Number(process.env.MARKET_CALENDAR_WINDOW_DAYS || DEFAULT_WINDOW_DAYS)));
    if (!apiKey) {
        logger.warn("POLYGON_API_KEY not configured; skipping market calendar sync.");
    }

    const polygonEvents = apiKey ? await loadPolygonEvents(now, windowDays, apiKey) : [];
    const macroEvents = await loadMacroEvents(now, windowDays);
    const earningsEvents = await loadEarningsEvents(now, 7);

    const events = mergeEvents(polygonEvents, macroEvents, earningsEvents);
    if (events.length === 0) {
        logger.info("No calendar events to sync.");
        return { updated: 0, removed: 0 };
    }

    const db = admin.firestore();
    const calendarRef = db.collection("market_calendar");
    const cutoffDate = new Date(now.getTime() - (windowDays * DAY_MS));

    const existingSnapshot = await calendarRef.get();
    const nextIds = new Set<string>();

    let batch = db.batch();
    let batchCount = 0;
    let removed = 0;
    const maxBatchSize = 450;

    for (const entry of events) {
        const docId = buildDocId(entry);
        nextIds.add(docId);
        const docRef = calendarRef.doc(docId);
        batch.set(docRef, {
            date: entry.date,
            event: entry.event,
            holiday: entry.holiday,
            market: entry.market,
            isOpen: entry.isOpen,
            earlyClose: entry.earlyClose,
            impact: entry.impact,
            symbols: entry.symbols ?? null,
            source: entry.source,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        batchCount += 1;
        if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    for (const doc of existingSnapshot.docs) {
        const data = doc.data();
        const dateStr = typeof data?.date === "string" ? data.date : "";
        const dateObj = isValidDate(dateStr) ? new Date(`${dateStr}T00:00:00Z`) : null;
        if (dateObj && dateObj < cutoffDate) {
            batch.delete(doc.ref);
            removed += 1;
            batchCount += 1;
        }
        if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    logger.info("Market calendar sync complete.", { updated: events.length, removed });
    return { updated: events.length, removed };
}

export const syncMarketCalendar = onSchedule({
    schedule: "15 6 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 540,
    memory: "512MiB"
}, async () => {
    await syncMarketCalendarInternal();
});

export const syncMarketCalendarManual = onRequest({
    timeoutSeconds: 540,
    memory: "512MiB"
}, async (req: any, res: any) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST").status(405).send("Method Not Allowed");
        return;
    }
    const result = await syncMarketCalendarInternal();
    res.status(200).json({ success: true, ...result });
});
