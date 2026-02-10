import * as logger from "firebase-functions/logger";
import { FunctionsErrorCode } from "firebase-functions/v2/https";
import { mapBridgeStatusToErrorCode, normalizeBridgeUrl } from "@wheel-strat/shared";
import { fetchWithTimeout } from "@/lib/fetch";
import { IBKR_BRIDGE_NOT_CONFIGURED, requireIbkrBridge } from "@/lib/ibkrGuards";
import { ibkrExecutionsSchema, ibkrHealthSchema, ibkrOrdersSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import { IBKRExecution, IBKROrder } from "./ibkrSyncTypes";
import { normalizeOrder } from "./ibkrSyncNormalize";
import {
    clampNumber,
    fetchBridgeWithRetry,
    isRetryableBridgeStatus,
    readBridgeErrorDetail,
    sleep
} from "./ibkrSyncUtils";
import { writeExecutions } from "./ibkrSyncExecutions";
import { writeOpenOrders } from "./ibkrSyncOrders";

export type SyncResult = {
    fills: number;
    fallbackUsed: number;
    error?: string;
    errorCode?: FunctionsErrorCode;
};

export type OrderSyncResult = {
    openOrders: number;
    removed: number;
    error?: string;
    errorCode?: FunctionsErrorCode;
};

export type ExecutionSyncOptions = {
    lookbackDays?: number;
    since?: string;
};

export async function performExecutionSync(
    fallbackUserId?: string,
    options: ExecutionSyncOptions = {}
): Promise<SyncResult> {
    try {
        const requestedLookback = Number.isFinite(options.lookbackDays) ? options.lookbackDays as number : 30;
        const boundedLookback = clampNumber(requestedLookback, 1, 30);
        const since = typeof options.since === "string" && options.since.trim() ? options.since.trim() : undefined;
        const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured, isEmulator } = requireIbkrBridge();
        if (!isEmulator && !bridgeUrlConfigured) {
            return { fills: 0, fallbackUsed: 0, error: IBKR_BRIDGE_NOT_CONFIGURED, errorCode: "failed-precondition" };
        }

        const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
        // Use a long timeout to accommodate potential bridge delays, but stay under the function timeout (300s)
        const fetchTimeout = Number(process.env.IBKR_EXECUTION_FETCH_TIMEOUT_MS || "290000");
        const syncStart = Date.now();
        const healthStart = Date.now();
        const maxHealthRetries = clampNumber(Number(process.env.IBKR_HEALTH_RETRY_COUNT || "3"), 0, 5);
        const healthRetryMs = clampNumber(Number(process.env.IBKR_HEALTH_RETRY_MS || "400"), 100, 2000);
        const healthAttempts = maxHealthRetries + 1;
        let healthResponse = await fetchBridgeWithRetry(
            `${normalizedBridgeUrl}/health?connect=false`,
            5000,
            bridgeApiKey,
            "Bridge health check",
            healthAttempts,
            healthRetryMs
        );
        let healthMs = Date.now() - healthStart;
        if (!healthResponse.ok) {
            logger.warn("Bridge health check failed before executions fetch", {
                status: healthResponse.status,
                ms: healthMs,
                lookbackDays: boundedLookback,
                since
            });
            return {
                fills: 0,
                fallbackUsed: 0,
                error: `Bridge health check failed: ${healthResponse.status}`,
                errorCode: mapBridgeStatusToErrorCode(healthResponse.status)
            };
        }

        let healthPayload: Record<string, any> | null = null;
        try {
            const rawHealth = await healthResponse.json();
            healthPayload = parseIbkrResponse(ibkrHealthSchema, rawHealth, "health");
        } catch (error) {
            logger.warn("Bridge health payload parse failed", { error: (error as Error)?.message });
        }

        for (let attempt = 0; attempt < maxHealthRetries; attempt++) {
            if (!healthPayload || healthPayload.status !== "busy") {
                break;
            }
            await sleep(healthRetryMs * (attempt + 1));
            healthResponse = await fetchBridgeWithRetry(
                `${normalizedBridgeUrl}/health?connect=false`,
                5000,
                bridgeApiKey,
                "Bridge health retry",
                healthAttempts,
                healthRetryMs
            );
            healthMs = Date.now() - healthStart;
            if (!healthResponse.ok) {
                logger.warn("Bridge health retry failed", { status: healthResponse.status, attempt: attempt + 1 });
                continue;
            }
            try {
                const rawHealth = await healthResponse.json();
                healthPayload = parseIbkrResponse(ibkrHealthSchema, rawHealth, "health");
            } catch (error) {
                logger.warn("Bridge health retry payload parse failed", { error: (error as Error)?.message });
            }
        }

        if (healthPayload?.status === "busy") {
            return {
                fills: 0,
                fallbackUsed: 0,
                error: "Bridge busy",
                errorCode: "unavailable"
            };
        }

        if (healthPayload && healthPayload.connected === false) {
            const connectResponse = await fetchBridgeWithRetry(
                `${normalizedBridgeUrl}/health?connect=true`,
                5000,
                bridgeApiKey,
                "Bridge connect",
                healthAttempts,
                healthRetryMs
            );
            if (!connectResponse.ok) {
                return {
                    fills: 0,
                    fallbackUsed: 0,
                    error: `Bridge connect failed: ${connectResponse.status}`,
                    errorCode: mapBridgeStatusToErrorCode(connectResponse.status)
                };
            }
            try {
                const rawConnect = await connectResponse.json();
                const connectPayload = parseIbkrResponse(ibkrHealthSchema, rawConnect, "health/connect");
                if (connectPayload?.connected === false) {
                    return {
                        fills: 0,
                        fallbackUsed: 0,
                        error: "Bridge disconnected",
                        errorCode: "unavailable"
                    };
                }
            } catch (error) {
                logger.warn("Bridge connect payload parse failed", { error: (error as Error)?.message });
            }
        }

        const fetchStart = Date.now();
        const queryParams = new URLSearchParams();
        if (since) {
            queryParams.set("since", since);
        } else {
            queryParams.set("lookbackDays", String(boundedLookback));
        }
        const executionsUrl = `${normalizedBridgeUrl}/executions?${queryParams.toString()}`;
        const maxRetries = clampNumber(Number(process.env.IBKR_EXECUTION_FETCH_RETRIES || "5"), 1, 6);
        const retryDelayMs = clampNumber(Number(process.env.IBKR_EXECUTION_FETCH_RETRY_MS || "800"), 200, 4000);
        const latencyWarnMs = clampNumber(Number(process.env.IBKR_EXECUTION_FETCH_WARN_MS || "20000"), 5000, 60000);
        let response: Awaited<ReturnType<typeof fetchWithTimeout>> | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                response = await fetchWithTimeout(executionsUrl, {}, fetchTimeout, bridgeApiKey);
            } catch (error) {
                if (attempt < maxRetries) {
                    logger.warn("Bridge executions fetch error; retrying", {
                        attempt,
                        maxRetries,
                        error: (error as Error)?.message
                    });
                    await sleep(retryDelayMs * attempt);
                    continue;
                }
                throw error;
            }
            if (response.ok) {
                break;
            }
            if (isRetryableBridgeStatus(response.status) && attempt < maxRetries) {
                logger.warn("Bridge executions busy; retrying", { status: response.status, attempt, maxRetries });
                await sleep(retryDelayMs * attempt);
                continue;
            }
            break;
        }
        const fetchMs = Date.now() - fetchStart;
        if (fetchMs > latencyWarnMs) {
            logger.warn("Bridge executions fetch latency high", {
                fetchMs,
                lookbackDays: boundedLookback,
                since
            });
        }

        if (!response || !response.ok) {
            const errorDetail = response ? await readBridgeErrorDetail(response) : null;
            if (response) {
                logger.warn("Bridge executions fetch failed", {
                    status: response.status,
                    detail: errorDetail || undefined
                });
            }
            return {
                fills: 0,
                fallbackUsed: 0,
                error: `Bridge error: ${response?.status ?? "unknown"}${errorDetail ? ` (${errorDetail})` : ""}`,
                errorCode: mapBridgeStatusToErrorCode(response?.status ?? 500)
            };
        }

        const rawExecutions = await response.json();
        const data = parseIbkrResponse(ibkrExecutionsSchema, rawExecutions, "executions");
        const executions = (data?.executions || []) as IBKRExecution[];
        if (executions.length > 0) {
            const orderRefSample = new Set<string>();
            let missingOrderRef = 0;
            let matchingOrderRef = 0;
            let otherOrderRef = 0;
            for (const exec of executions) {
                const orderRef = exec.orderRef;
                if (!orderRef) {
                    missingOrderRef += 1;
                    continue;
                }
                if (orderRefSample.size < 5) {
                    orderRefSample.add(orderRef);
                }
                if (fallbackUserId && orderRef === fallbackUserId) {
                    matchingOrderRef += 1;
                } else {
                    otherOrderRef += 1;
                }
            }
            logger.info("Execution orderRef stats", {
                matchingOrderRef,
                missingOrderRef,
                otherOrderRef,
                sampleOrderRefs: Array.from(orderRefSample),
                uid: fallbackUserId ?? null
            });
        }

        if (executions.length === 0) {
            logger.info("Bridge executions fetched (empty)", { count: 0, ms: fetchMs, lookbackDays: boundedLookback, since });
            return { fills: 0, fallbackUsed: 0 };
        }

        logger.info("Bridge executions fetched", { count: executions.length, ms: fetchMs, lookbackDays: boundedLookback, since });
        const writeStart = Date.now();
        const result = await writeExecutions(executions, fallbackUserId);
        const writeMs = Date.now() - writeStart;
        logger.info("Executions written", { newFills: result.fills, fallbackUsed: result.fallbackUsed, ms: writeMs });
        logger.info("Execution sync complete", {
            totalMs: Date.now() - syncStart,
            healthMs,
            fetchMs,
            writeMs,
            lookbackDays: boundedLookback,
            since,
            fills: result.fills
        });
        return { fills: result.fills, fallbackUsed: result.fallbackUsed };
    } catch (error: any) {
        return { fills: 0, fallbackUsed: 0, error: error.message, errorCode: "unavailable" };
    }
}

export async function performOpenOrdersSync(userId: string): Promise<OrderSyncResult> {
    try {
        const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured, isEmulator } = requireIbkrBridge();
        if (!isEmulator && !bridgeUrlConfigured) {
            return { openOrders: 0, removed: 0, error: IBKR_BRIDGE_NOT_CONFIGURED, errorCode: "failed-precondition" as FunctionsErrorCode };
        }

        const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
        const fetchTimeout = clampNumber(Number(process.env.IBKR_ORDERS_FETCH_TIMEOUT_MS || "20000"), 3000, 60000);
        const maxRetries = clampNumber(Number(process.env.IBKR_ORDERS_FETCH_RETRIES || "3"), 1, 6);
        const retryDelayMs = clampNumber(Number(process.env.IBKR_ORDERS_FETCH_RETRY_MS || "700"), 200, 4000);
        const ordersUrl = `${normalizedBridgeUrl}/orders`;

        let response: Awaited<ReturnType<typeof fetchWithTimeout>> | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                response = await fetchWithTimeout(ordersUrl, {}, fetchTimeout, bridgeApiKey);
            } catch (error) {
                if (attempt < maxRetries) {
                    logger.warn("Bridge orders fetch error; retrying", {
                        attempt,
                        maxRetries,
                        error: (error as Error)?.message
                    });
                    await sleep(retryDelayMs * attempt);
                    continue;
                }
                throw error;
            }
            if (response.ok) {
                break;
            }
            if (isRetryableBridgeStatus(response.status) && attempt < maxRetries) {
                logger.warn("Bridge orders busy; retrying", { status: response.status, attempt, maxRetries });
                await sleep(retryDelayMs * attempt);
                continue;
            }
            break;
        }

        if (!response || !response.ok) {
            const errorDetail = response ? await readBridgeErrorDetail(response) : null;
            if (response) {
                logger.warn("Bridge orders fetch failed", {
                    status: response.status,
                    detail: errorDetail || undefined
                });
            }
            return {
                openOrders: 0,
                removed: 0,
                error: `Bridge error: ${response?.status ?? "unknown"}${errorDetail ? ` (${errorDetail})` : ""}`,
                errorCode: mapBridgeStatusToErrorCode(response?.status ?? 500)
            };
        }

        const rawOrders = await response.json();
        const data = parseIbkrResponse(ibkrOrdersSchema, rawOrders, "orders");
        const orders = (data?.orders || [])
            .map((entry) => normalizeOrder(entry))
            .filter(Boolean) as IBKROrder[];

        if (orders.length === 0) {
            logger.info("Bridge orders fetched (empty)", { count: 0 });
            const cleared = await writeOpenOrders([], userId);
            return { openOrders: cleared.openOrders, removed: cleared.removed };
        }

        let missingOrderRef = 0;
        let matchingOrderRef = 0;
        let otherOrderRef = 0;
        const sampleOrderRefs = new Set<string>();
        for (const order of orders) {
            const orderRef = order.orderRef;
            if (!orderRef) {
                missingOrderRef += 1;
                continue;
            }
            if (sampleOrderRefs.size < 5) {
                sampleOrderRefs.add(orderRef);
            }
            if (orderRef === userId) {
                matchingOrderRef += 1;
            } else {
                otherOrderRef += 1;
            }
        }

        const filteredOrders = orders.filter((order) => order.orderRef === userId);
        logger.info("Bridge orders fetched", {
            total: orders.length,
            matched: filteredOrders.length,
            missingOrderRef,
            otherOrderRef,
            sampleOrderRefs: Array.from(sampleOrderRefs)
        });

        const result = await writeOpenOrders(filteredOrders, userId);
        logger.info("Open orders synced", { openOrders: result.openOrders, removed: result.removed });
        return { openOrders: result.openOrders, removed: result.removed };
    } catch (error: any) {
        return { openOrders: 0, removed: 0, error: error.message, errorCode: "unavailable" };
    }
}
