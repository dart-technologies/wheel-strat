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
    timeoutMs = 60000,
    account
}: BridgeFetchOptions & { account?: string }): Promise<BridgePortfolioPayload> {
    const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
    const headers = {
        "ngrok-skip-browser-warning": "1",
    };

    logger.info(`${context}: bridge fetch starting`, {
        bridgeUrl,
        normalizedBridgeUrl,
        timeout: timeoutMs,
        account
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

    let positionsResponse = await fetchWithRetry("/portfolio");
    if (!positionsResponse.ok) {
        logger.warn(`${context}: bridge portfolio fetch failed, falling back to /positions`, {
            status: positionsResponse.status
        });
        positionsResponse = await fetchWithRetry("/positions", 0);
    }
    if (!positionsResponse.ok) {
        throw new HttpsError("unavailable", `Bridge positions fetch failed: ${positionsResponse.status} on ${normalizedBridgeUrl}`);
    }

    const summaryResponse = await fetchWithRetry("/account-summary");
    if (!summaryResponse.ok) {
        throw new HttpsError("unavailable", `Bridge account summary fetch failed: ${summaryResponse.ok} on ${normalizedBridgeUrl}`);
    }

    // Parse summary early to extract account ID for subsequent P&L calls
    let summaryJson: any = null;
    let accountId = account;
    try {
        summaryJson = await summaryResponse.json();
        if (summaryJson && typeof summaryJson === 'object') {
            accountId = accountId || (summaryJson.AccountCode as string);
        }
    } catch (error) {
        logger.error(`${context}: bridge account summary JSON parse failed`, { error: (error as Error)?.message });
        throw new HttpsError("internal", "Bridge account summary JSON parse failed");
    }

    // NEW: Fetch robust P&L data from /pnl endpoint using extracted account ID
    let pnlResponse: any = null;
    try {
        const pnlPath = accountId ? `/pnl?account=${accountId}` : "/pnl";
        pnlResponse = await fetchWithRetry(pnlPath, 0);
    } catch (err) {
        logger.warn(`${context}: bridge /pnl fetch failed - optional`, { error: (err as Error).message });
    }

    let positionsJson: any = null;
    let pnlJson: any = null;
    try {
        const promises: Promise<any>[] = [
            positionsResponse.json()
        ];
        if (pnlResponse?.ok) {
            promises.push(pnlResponse.json());
        }

        const results = await Promise.all(promises);
        positionsJson = results[0];
        pnlJson = results[1] || null;

        if (!pnlJson) {
            logger.info(`${context}: /pnl returned null or failed, relying on account summary tags only`);
        }

        // Merge P&L data into summaryJson if available
        if (summaryJson && pnlJson && typeof pnlJson === 'object') {
            summaryJson = {
                ...summaryJson,
                DailyPnL: pnlJson.dailyPnL ?? summaryJson.DailyPnL,
                RealizedPnL: pnlJson.realizedPnL ?? summaryJson.RealizedPnL,
                UnrealizedPnL: pnlJson.unrealizedPnL ?? summaryJson.UnrealizedPnL,
            };
        }

        // Diagnostic logging for account-summary tags
        if (summaryJson && typeof summaryJson === 'object') {
            const raw = summaryJson as Record<string, unknown>;
            logger.info(`${context}: bridge account summary raw tags`, {
                tags: Object.keys(raw),
                values: {
                    DailyPnL: raw.DailyPnL,
                    RealizedPnL: raw.RealizedPnL,
                    UnrealizedPnL: raw.UnrealizedPnL,
                    TotalCashValue: raw.TotalCashValue,
                    NetLiquidation: raw.NetLiquidation
                }
            });
        }
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

export async function fetchPnLSingle(
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    conId: number,
    account: string = ""
): Promise<any> {
    const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
    const headers = { "ngrok-skip-browser-warning": "1" };
    const url = `${normalizedBridgeUrl}/pnl-single?conId=${conId}&account=${account}`;

    try {
        const res = await fetchWithTimeout(url, { headers }, 10000, bridgeApiKey);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        logger.warn(`fetchPnLSingle failed for conId ${conId}`, { error: (err as Error).message });
        return null;
    }
}
