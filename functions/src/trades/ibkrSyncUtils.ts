import * as logger from "firebase-functions/logger";
import { fetchWithTimeout } from "@/lib/fetch";
import { IBKRExecution } from "./ibkrSyncTypes";

export function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toNumber(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function isRetryableBridgeStatus(status: number) {
    return status === 502 || status === 503 || status === 504;
}

export async function fetchBridgeWithRetry(
    url: string,
    timeoutMs: number,
    bridgeApiKey: string | undefined,
    label: string,
    maxAttempts: number,
    retryDelayMs: number
) {
    let lastError: Error | null = null;
    const attempts = Math.max(1, maxAttempts);
    const delayMs = Math.max(100, retryDelayMs);

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetchWithTimeout(url, {}, timeoutMs, bridgeApiKey);
            if (response.ok) {
                return response;
            }
            if (isRetryableBridgeStatus(response.status) && attempt < attempts) {
                logger.warn(`${label} failed; retrying`, { status: response.status, attempt, attempts });
                await sleep(delayMs * attempt);
                continue;
            }
            return response;
        } catch (error) {
            lastError = error as Error;
            if (attempt < attempts) {
                logger.warn(`${label} request error; retrying`, { attempt, attempts, error: lastError.message });
                await sleep(delayMs * attempt);
                continue;
            }
            throw lastError;
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error(`${label} request failed after ${attempts} attempts`);
}

export async function readBridgeErrorDetail(response: Awaited<ReturnType<typeof fetchWithTimeout>>) {
    try {
        const rawText = (await response.text()).trim();
        if (!rawText) return null;
        try {
            const parsed = JSON.parse(rawText);
            if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                return String((parsed as { error?: unknown }).error ?? '').trim() || rawText.slice(0, 200);
            }
        } catch {
            // Non-JSON response; fall through to raw snippet.
        }
        return rawText.slice(0, 200);
    } catch {
        return null;
    }
}

export function normalizeExecution(raw: any): IBKRExecution | null {
    if (!raw || typeof raw !== 'object') return null;
    const execId = String(raw.execId || '').trim();
    const symbol = String(raw.symbol || '').trim();
    if (!execId || !symbol) return null;
    const expiration = raw.expiration
        ? String(raw.expiration)
        : raw.lastTradeDateOrContractMonth
            ? String(raw.lastTradeDateOrContractMonth)
            : undefined;
    const strikeValue = toNumber(raw.strike);
    const strike = typeof strikeValue === 'number' && strikeValue > 0 ? strikeValue : undefined;
    return {
        execId,
        time: String(raw.time || ''),
        symbol,
        secType: String(raw.secType || ''),
        side: raw.side === 'SLD' ? 'SLD' : 'BOT',
        shares: Number(raw.shares || 0),
        price: Number(raw.price || 0),
        avgPrice: Number(raw.avgPrice ?? raw.price ?? 0),
        commission: toNumber(raw.commission),
        orderRef: String(raw.orderRef || ''),
        cumQty: raw.cumQty !== undefined ? Number(raw.cumQty) : undefined,
        strike,
        right: raw.right ? String(raw.right) : undefined,
        expiration,
        localSymbol: raw.localSymbol ? String(raw.localSymbol) : undefined,
        conId: raw.conId !== undefined && raw.conId !== null ? Number(raw.conId) : undefined,
        multiplier: raw.multiplier !== undefined && raw.multiplier !== null ? Number(raw.multiplier) : undefined
    };
}

export function normalizeExpiration(value?: string) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (digits.length === 8) return digits;
    return null;
}
