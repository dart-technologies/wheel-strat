import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { getDB, isDbConfigured, resolveDbConnection } from "@/lib/cloudsql";
import { notifyPositionAlert } from "@/notifications/notifications";
import { analyzeIssuesWithAI } from "./healthAi";
import { checkBridgeHealth, checkDatabaseHealth, checkGeminiHealth } from "./healthChecks";
import { scanErrorLogs } from "./healthLogs";
import type { ServiceStatus } from "./healthTypes";

const HEALTH_REPORT_COLLECTION = "system_health";

/**
 * Centrally check all backend services
 */
export const checkSystemHealth = onSchedule({
    schedule: "45 9,15 * * 1-5",
    timeZone: "America/New_York"
}, async (event) => {
    const db = admin.firestore();
    const results: Record<string, ServiceStatus> = {};
    let criticalFailure = false;

    // 1. Check IBKR Bridge
    results.bridge = await checkBridgeHealth();
    if (results.bridge.status === "error") criticalFailure = true;

    // 2. Check Database
    results.database = await checkDatabaseHealth();
    if (results.database.status === "error") criticalFailure = true;

    // 3. Check Gemini
    results.gemini = await checkGeminiHealth();

    // 4. Scan Logs for Errors
    const logErrors = await scanErrorLogs();
    results.logs = {
        status: logErrors.length > 0 ? "warning" : "ok",
        message: logErrors.length > 0 ? `${logErrors.length} recent errors found` : "No recent errors",
        details: logErrors
    };

    // 5. Generate AI Summary if issues exist
    let aiAnalysis = null;
    if (criticalFailure || logErrors.length > 0) {
        aiAnalysis = await analyzeIssuesWithAI(results, logErrors);
    }

    // 6. Persist Report
    const report = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        results,
        aiAnalysis,
        criticalFailure
    };
    await db.collection(HEALTH_REPORT_COLLECTION).add(report);

    // 7. Alert if Critical
    if (criticalFailure) {
        await notifyPositionAlert("SYSTEM", 0, "Outage Detected", {
            reasoning: aiAnalysis?.summary || "Critical services are down.",
            type: "system_health_alert"
        });
    }

    logger.info("System Health Check Complete", report);
    return;
});

/**
 * Manual DB connectivity check (secured by IBKR bridge API key).
 */
export const checkDatabaseConnectivity = onRequest({
    timeoutSeconds: 60,
    memory: "256MiB"
}, async (req: any, res: any) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.set('Allow', 'GET, POST').status(405).send('Method Not Allowed');
        return;
    }

    const { bridgeApiKey } = requireIbkrBridge();
    const providedKey = req.get('X-API-KEY') || req.get('x-api-key') || '';
    if (bridgeApiKey && providedKey !== bridgeApiKey) {
        res.status(401).send('Unauthorized');
        return;
    }

    if (!isDbConfigured()) {
        res.status(200).json({
            status: "warning",
            message: "Database not configured",
            configured: false
        });
        return;
    }

    const connection = resolveDbConnection();
    const connectionInfo = connection?.socketPath
        ? { type: "socket", target: connection.socketPath }
        : connection?.host
            ? { type: "host", target: connection.host }
            : { type: "unknown", target: null };

    try {
        const knex = getDB();
        await knex.raw("SELECT 1");
        res.status(200).json({
            status: "ok",
            message: "Database connected",
            configured: true,
            connection: connectionInfo
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error?.message || "Database connection failed",
            configured: true,
            connection: connectionInfo
        });
    }
});
