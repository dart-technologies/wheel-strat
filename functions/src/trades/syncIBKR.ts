import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { isMarketOpen } from "@/lib/time";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { IBKRExecution } from "./ibkrSyncTypes";
import { clampNumber, normalizeExecution } from "./ibkrSyncUtils";
import { writeExecutions } from "./ibkrSyncExecutions";
import { writeOpenOrders } from "./ibkrSyncOrders";
import { performExecutionSync, performOpenOrdersSync } from "./ibkrSyncCoordinator";

/**
 * Core logic to pull executions from the bridge and sync to Firestore
 */
export { writeExecutions, writeOpenOrders };

export const ingestIbkrExecutions = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.set('Allow', 'POST').status(405).send('Method Not Allowed');
        return;
    }

    const { bridgeApiKey } = requireIbkrBridge();
    const providedKey = req.get('X-API-KEY') || req.get('x-api-key') || '';
    if (bridgeApiKey && providedKey !== bridgeApiKey) {
        res.status(401).send('Unauthorized');
        return;
    }

    let payload: any = req.body;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (error) {
            res.status(400).json({ error: 'Invalid JSON body' });
            return;
        }
    }

    const rawExecutions = Array.isArray(payload?.executions)
        ? payload.executions
        : payload?.execution
            ? [payload.execution]
            : [];

    if (rawExecutions.length === 0) {
        res.status(400).json({ error: 'No executions provided' });
        return;
    }

    const executions = rawExecutions
        .map((entry: any) => normalizeExecution(entry))
        .filter(Boolean) as IBKRExecution[];

    if (executions.length === 0) {
        res.status(400).json({ error: 'No valid executions provided' });
        return;
    }

    try {
        const result = await writeExecutions(executions);
        res.status(200).json({
            success: true,
            newFills: result.fills,
            received: rawExecutions.length,
            accepted: executions.length
        });
    } catch (error) {
        logger.error('Execution webhook ingest failed:', error);
        res.status(500).json({ error: 'Failed to ingest executions' });
    }
});

/**
 * Scheduled sync: Polls hourly during market hours as a safety net.
 * Event-driven webhook ingestion handles real-time updates.
 */
export const syncIBKRExecutions = onSchedule({
    schedule: '0 10-16 * * 1-5', // Hourly from 10 AM to 4 PM ET
    timeZone: 'America/New_York'
}, async (event) => {
    // Optimization: Don't poll if market is closed (holidays/weekends)
    if (!isMarketOpen(new Date())) {
        logger.info('Market closed, skipping scheduled execution sync.');
        return;
    }

    logger.info('🔄 Scheduled sync of executions from IBKR Bridge...');
    // Use 5 days lookback for scheduled sync to cover weekends/holidays safely
    const result = await performExecutionSync(undefined, { lookbackDays: 5 });

    if (result.error) {
        logger.error('Error in scheduled syncIBKRExecutions:', result.error);
    } else {
        logger.info(`✅ Scheduled sync complete. New fills: ${result.fills}`);
    }
});

/**
 * Event-Driven Sync: Can be triggered by the user after placing a trade.
 * Reduces latency between trade placement and journal appearance.
 */
export const manualSyncIBKR = onCall({
    timeoutSeconds: 300,
    memory: '512MiB'
}, async (request) => {
    const data = request.data;
    const context = { auth: request.auth }; // Shim context for basic compat logic
    try {
        // Basic auth check
        if (!context.auth) {
            throw new HttpsError('unauthenticated', 'Must be signed in to sync trades.');
        }

        const { bridgeUrl, tradingMode } = requireIbkrBridge();
        const envLookback = Number(process.env.IBKR_MANUAL_SYNC_LOOKBACK_DAYS || '30');
        const requestedLookback = Number(data?.lookbackDays);
        const requestedSince = typeof data?.since === 'string' ? data.since : undefined;
        const lookbackDays = clampNumber(
            Number.isFinite(requestedLookback) && requestedLookback > 0 ? requestedLookback : envLookback,
            1,
            30
        );
        logger.info('👤 User triggered manual execution sync.', {
            uid: context.auth.uid,
            bridgeUrl,
            tradingMode,
            lookbackDays,
            since: requestedSince
        });
        const result = await performExecutionSync(context.auth.uid, { lookbackDays, since: requestedSince });

        if (result.error) {
            throw new HttpsError(result.errorCode || 'internal', `Sync failed: ${result.error}`);
        }

        if (result.fallbackUsed > 0) {
            logger.warn('Manual sync used fallback userId for executions', {
                fallbackUsed: result.fallbackUsed,
                uid: context.auth.uid
            });
        }

        const ordersResult = await performOpenOrdersSync(context.auth.uid);
        if (ordersResult.error) {
            logger.warn('Open orders sync failed', {
                error: ordersResult.error,
                uid: context.auth.uid
            });
        }

        return {
            success: true,
            newFills: result.fills,
            openOrders: ordersResult.openOrders,
            removedOrders: ordersResult.removed
        };
    } catch (error: any) {
        logger.error('Unhandled error in manualSyncIBKR:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `Internal Sync Error: ${error.message || error}`);
    }
});
