import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { normalizeBridgeUrl } from "@wheel-strat/shared";
import { fetchWithTimeout } from "@/lib/fetch";
import { ibkrAccountSummarySchema, ibkrPositionsSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";

type BridgePortfolioPayload = {
    positionsPayload: { positions?: unknown[] } | null;
    summaryPayload: Record<string, unknown> | null;
};

type BridgeFetchOptions = {
    bridgeUrl: string;
    bridgeApiKey?: string;
    context: string;
    timeoutMs?: number;
};

export async function fetchBridgePortfolioPayload({
    bridgeUrl,
    bridgeApiKey,
    context,
    timeoutMs = 60000
}: BridgeFetchOptions): Promise<BridgePortfolioPayload> {
    const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
    const headers = {
        "ngrok-skip-browser-warning": "1",
    };

    logger.info(`${context}: bridge fetch starting`, {
        bridgeUrl,
        normalizedBridgeUrl,
        timeout: timeoutMs
    });

    const readResponseSnippet = async (response: { text: () => Promise<string> }) => {
        try {
            const text = await response.text();
            if (!text) return null;
            return text.slice(0, 400);
        } catch {
            return null;
        }
    };

    const fetchWithRetry = async (path: string, retryCount = 2) => {
        let lastError: Error | null = null;
        const fullUrl = `${normalizedBridgeUrl}${path}`;
        for (let i = 0; i <= retryCount; i++) {
            try {
                const res = await fetchWithTimeout(fullUrl, { headers }, timeoutMs, bridgeApiKey);
                if (res.ok) return res;
                if (res.status === 503 || res.status === 502 || res.status === 504) {
                    logger.warn(`${context}: bridge busy on ${path}, retry ${i}/${retryCount}`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    continue;
                }
                const snippet = await readResponseSnippet(res);
                logger.warn(`${context}: bridge response not ok`, {
                    path,
                    fullUrl,
                    status: res.status,
                    snippet
                });
                return res;
            } catch (err) {
                lastError = err as Error;
                logger.warn(`${context}: fetch error on ${path}, retry ${i}/${retryCount}`, { error: lastError.message });
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        throw lastError || new Error(`Failed to fetch ${path} after ${retryCount} retries`);
    };

    const positionsResponse = await fetchWithRetry("/positions");
    if (!positionsResponse.ok) {
        throw new HttpsError("unavailable", `Bridge positions fetch failed: ${positionsResponse.status}`);
    }

    const summaryResponse = await fetchWithRetry("/account-summary");
    if (!summaryResponse.ok) {
        throw new HttpsError("unavailable", `Bridge account summary fetch failed: ${summaryResponse.status}`);
    }

    let positionsJson: unknown = null;
    let summaryJson: unknown = null;
    try {
        [positionsJson, summaryJson] = await Promise.all([
            positionsResponse.json(),
            summaryResponse.json()
        ]);
    } catch (error) {
        const positionsSnippet = await readResponseSnippet(positionsResponse);
        const summarySnippet = await readResponseSnippet(summaryResponse);
        logger.error(`${context}: bridge JSON parse failed`, {
            error: (error as Error)?.message,
            positionsStatus: positionsResponse.status,
            summaryStatus: summaryResponse.status,
            positionsSnippet,
            summarySnippet
        });
        throw new HttpsError("internal", "Bridge response JSON parse failed");
    }

    const positionsPayload = parseIbkrResponse(
        ibkrPositionsSchema,
        positionsJson,
        "positions"
    );
    if (!positionsPayload) {
        const payloadKeys = positionsJson && typeof positionsJson === "object"
            ? Object.keys(positionsJson as Record<string, unknown>)
            : [];
        logger.error(`${context}: invalid positions payload`, { payloadType: typeof positionsJson, payloadKeys });
        throw new HttpsError("internal", "Invalid positions payload");
    }

    const summaryPayload = parseIbkrResponse(
        ibkrAccountSummarySchema,
        summaryJson,
        "account-summary"
    );

    return {
        positionsPayload: positionsPayload as { positions?: unknown[] },
        summaryPayload: (summaryPayload ?? null) as Record<string, unknown> | null
    };
}
