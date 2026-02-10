import { fetchWithTimeout } from "@/lib/fetch";
import { ibkrHistoricalSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";

export type HistoricalFetchConfig = {
    symbol: string;
    barSize: string;
    duration: string;
    endDateTime?: string;
    whatToShow?: string;
    useRTH?: boolean;
    secType?: string;
};

export type NormalizedBar = {
    date: string;
    timestamp: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number;
};

export function normalizeIbkrTimestamp(value: unknown): { date: string | null; timestamp: string | null } {
    if (!value) return { date: null, timestamp: null };
    let raw = String(value).trim();
    if (!raw) return { date: null, timestamp: null };
    raw = raw.replace('T', ' ').replace('Z', '');
    const parts = raw.split(' ').filter(Boolean);
    const datePart = parts[0];
    let timePart = parts[1] || '00:00:00';

    let normalizedDate = datePart;
    if (/^\d{8}$/.test(datePart)) {
        normalizedDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    }

    if (/^\d{2}:\d{2}$/.test(timePart)) {
        timePart = `${timePart}:00`;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        return { date: null, timestamp: null };
    }

    return {
        date: normalizedDate,
        timestamp: `${normalizedDate} ${timePart}`
    };
}

type IbkrHistoricalBarLike = {
    date?: any;
    open?: any;
    high?: any;
    low?: any;
    close?: any;
    volume?: any;
};

export function normalizeIbkrBars(rawBars: IbkrHistoricalBarLike[]): NormalizedBar[] {
    const normalized = rawBars.map((bar) => {
        const normalizedDate = normalizeIbkrTimestamp(bar.date);
        return {
            date: normalizedDate.date,
            timestamp: normalizedDate.timestamp,
            open: Number.isFinite(Number(bar.open)) ? Number(bar.open) : null,
            high: Number.isFinite(Number(bar.high)) ? Number(bar.high) : null,
            low: Number.isFinite(Number(bar.low)) ? Number(bar.low) : null,
            close: Number.isFinite(Number(bar.close)) ? Number(bar.close) : null,
            volume: Number.isFinite(Number(bar.volume)) ? Math.trunc(Number(bar.volume)) : 0
        } as NormalizedBar;
    }).filter((bar) => bar.date && bar.timestamp);

    normalized.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return normalized;
}

export async function fetchIbkrHistoricalBars(
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    config: HistoricalFetchConfig,
    timeoutMs: number = 60000
): Promise<NormalizedBar[]> {
    const response = await fetchWithTimeout(`${bridgeUrl}/historical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            symbol: config.symbol,
            secType: config.secType || 'STK',
            duration: config.duration,
            barSize: config.barSize,
            endDateTime: config.endDateTime || '',
            whatToShow: config.whatToShow || 'TRADES',
            useRTH: config.useRTH ?? true
        })
    }, timeoutMs, bridgeApiKey);

    if (!response.ok) {
        console.warn(`[ibkrHistorical] IBKR historical failed for ${config.symbol}: ${response.status}`);
        return [];
    }

    let rawPayload: unknown;
    try {
        rawPayload = await response.json();
    } catch (error) {
        console.warn(`[ibkrHistorical] Failed to parse historical payload for ${config.symbol}`, error);
        return [];
    }

    const payload = parseIbkrResponse(ibkrHistoricalSchema, rawPayload, `historical/${config.symbol}`);
    if (!payload || !Array.isArray(payload.bars)) return [];

    return normalizeIbkrBars(payload.bars);
}
