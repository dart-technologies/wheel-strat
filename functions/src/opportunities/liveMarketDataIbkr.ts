import { HttpsError } from "firebase-functions/v2/https";
import { fetchWithTimeout } from "@/lib/fetch";
import { IBKR_BRIDGE_NOT_CONFIGURED } from "@/lib/ibkrGuards";
import {
    ibkrHealthSchema,
    ibkrMarketDataBatchSchema,
    ibkrMarketQuoteSchema,
    ibkrOptionChainBatchSchema,
    ibkrOptionChainSchema,
    ibkrOptionQuoteBatchSchema,
    ibkrOptionQuoteSchema,
    parseIbkrResponse
} from "@/lib/ibkrSchemas";

type IbkrHealthGuard = {
    ensureIbkrHealthy: () => Promise<boolean>;
    getHealthError: () => HttpsError | null;
};

export const createIbkrHealthGuard = (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    bridgeUrlConfigured: boolean
): IbkrHealthGuard => {
    let ibkrHealthChecked = false;
    let ibkrHealthy = false;
    let ibkrHealthError: HttpsError | null = null;

    const ensureIbkrHealthy = async () => {
        if (!bridgeUrlConfigured) {
            ibkrHealthError = new HttpsError("failed-precondition", IBKR_BRIDGE_NOT_CONFIGURED);
            return false;
        }
        if (ibkrHealthChecked) return ibkrHealthy;
        ibkrHealthChecked = true;
        try {
            const healthRes = await fetchWithTimeout(`${bridgeUrl}/health`, {}, 15000, bridgeApiKey);
            const rawHealth = await healthRes.json();
            const health = parseIbkrResponse(ibkrHealthSchema, rawHealth, "health");
            if (!health?.connected) {
                ibkrHealthError = new HttpsError("unavailable", "IBKR Bridge not connected to IB Gateway");
                ibkrHealthy = false;
                return false;
            }
            ibkrHealthy = true;
            return true;
        } catch (error) {
            console.error("[liveMarketData] Bridge health check failed:", error);
            ibkrHealthError = new HttpsError("unavailable", `Cannot reach IBKR Bridge server at ${bridgeUrl}`);
            ibkrHealthy = false;
            return false;
        }
    };

    return {
        ensureIbkrHealthy,
        getHealthError: () => ibkrHealthError
    };
};

export const fetchIbkrMarketDataBatch = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    symbols: string[]
) => {
    const res = await fetchWithTimeout(`${bridgeUrl}/market-data/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
    }, 60000, bridgeApiKey);
    if (!res.ok) return [];
    const rawPayload = await res.json();
    const payload = parseIbkrResponse(ibkrMarketDataBatchSchema, rawPayload, "market-data/batch");
    return payload && Array.isArray(payload.results) ? payload.results : [];
};

export const fetchIbkrOptionChainBatch = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    symbols: string[]
) => {
    const res = await fetchWithTimeout(`${bridgeUrl}/option-chain/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
    }, 60000, bridgeApiKey);
    if (!res.ok) return [];
    const rawPayload = await res.json();
    const payload = parseIbkrResponse(ibkrOptionChainBatchSchema, rawPayload, "option-chain/batch");
    return payload && Array.isArray(payload.results) ? payload.results : [];
};

export const fetchIbkrMarketDataSingle = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    symbol: string
) => {
    const res = await fetchWithTimeout(`${bridgeUrl}/market-data/${symbol}`, undefined, 30000, bridgeApiKey);
    if (!res.ok) return null;
    const rawQuote = await res.json();
    return parseIbkrResponse(ibkrMarketQuoteSchema, rawQuote, `market-data/${symbol}`);
};

export const fetchIbkrOptionChainSingle = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    symbol: string
) => {
    const res = await fetchWithTimeout(`${bridgeUrl}/option-chain/${symbol}`, undefined, 30000, bridgeApiKey);
    if (!res.ok) return null;
    const rawChain = await res.json();
    return parseIbkrResponse(ibkrOptionChainSchema, rawChain, `option-chain/${symbol}`);
};

export const fetchIbkrOptionQuotesBatch = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    contracts: Array<{ symbol: string; strike: number; expiration: string; right: "C" | "P" }>
) => {
    if (contracts.length === 0) return [];
    const fallbackToSingle = async () => {
        const results: Array<Record<string, unknown>> = [];
        for (const contract of contracts) {
            const single = await fetchIbkrOptionQuoteSingle(bridgeUrl, bridgeApiKey, contract);
            if (single) {
                results.push({
                    ...single,
                    symbol: contract.symbol,
                    expiration: contract.expiration,
                    right: contract.right,
                    strike: contract.strike
                });
            }
        }
        return results;
    };

    const res = await fetchWithTimeout(`${bridgeUrl}/option-quote/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contracts })
    }, 60000, bridgeApiKey);
    if (!res.ok) {
        return fallbackToSingle();
    }
    const rawPayload = await res.json();
    const payload = parseIbkrResponse(ibkrOptionQuoteBatchSchema, rawPayload, "option-quote/batch");
    const results = payload && Array.isArray(payload.results) ? payload.results : [];
    if (results.length === 0) {
        return fallbackToSingle();
    }
    return results;
};

const fetchIbkrOptionQuoteSingle = async (
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    contract: { symbol: string; strike: number; expiration: string; right: "C" | "P" }
) => {
    const res = await fetchWithTimeout(`${bridgeUrl}/option-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contract)
    }, 30000, bridgeApiKey);
    if (!res.ok) return null;
    const rawPayload = await res.json();
    return parseIbkrResponse(ibkrOptionQuoteSchema, rawPayload, "option-quote");
};
