import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
    buildExpiredOptionClosures,
    buildVirtualTradeId,
    chunkArray
} from "./expireOptionsUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

export const closeExpiredOptions = onSchedule({
    schedule: '30 17 * * 1-5',
    timeZone: 'America/New_York'
}, async () => {
    const db = admin.firestore();
    const now = new Date();
    const lookbackDays = Math.max(30, Math.min(365, Number(process.env.EXPIRED_OPTION_LOOKBACK_DAYS || '180')));
    const lookbackStart = new Date(now.getTime() - (lookbackDays * DAY_MS));
    const startDate = lookbackStart.toISOString().split('T')[0];

    logger.info('Checking for expired options to close.', { lookbackDays, startDate });

    const snapshot = await db.collection('user_trades')
        .where('date', '>=', startDate)
        .get();

    if (snapshot.empty) {
        logger.info('No trades found for expiration check.');
        return;
    }

    const trades = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const closures = buildExpiredOptionClosures(trades, now);

    if (closures.length === 0) {
        logger.info('No expired option closures needed.');
        return;
    }

    const candidates = closures.map((closure) => ({
        ...closure,
        docId: buildVirtualTradeId(closure.userId, closure.contractKey)
    }));

    const existingIds = new Set<string>();
    const refChunks = chunkArray(candidates, 200);
    for (const chunk of refChunks) {
        const refs = chunk.map((candidate) => db.collection('user_trades').doc(candidate.docId));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap) => {
            if (snap.exists) {
                existingIds.add(snap.id);
            }
        });
    }

    let batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 450;
    let written = 0;

    for (const candidate of candidates) {
        if (existingIds.has(candidate.docId)) continue;
        const docRef = db.collection('user_trades').doc(candidate.docId);
        batch.set(docRef, {
            symbol: candidate.symbol,
            type: candidate.type,
            quantity: candidate.quantity,
            price: 0,
            date: candidate.expiration,
            total: 0,
            userId: candidate.userId,
            status: 'Filled',
            secType: candidate.secType,
            right: candidate.right,
            strike: candidate.strike,
            expiration: candidate.expiration,
            multiplier: candidate.multiplier,
            localSymbol: candidate.localSymbol ?? null,
            conId: candidate.conId ?? null,
            commission: 0,
            synthetic: true,
            source: 'expiration',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        batchCount++;
        written++;

        if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    logger.info('Expired option closures written.', { written, candidates: candidates.length });
});
