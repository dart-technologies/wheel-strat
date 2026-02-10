import { requireIbkrBridge } from "@/lib/ibkrGuards";

export function parseBooleanEnv(value: string | undefined, fallback: boolean) {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
}

export function parseNumberEnv(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSymbols(input: unknown): string[] | null {
    if (!input) return null;
    if (Array.isArray(input)) {
        const normalized = input
            .map((value) => String(value).trim().toUpperCase())
            .filter(Boolean);
        return normalized.length ? normalized : null;
    }
    if (typeof input === 'string') {
        const normalized = input
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);
        return normalized.length ? normalized : null;
    }
    return null;
}

export function requireApiKey(req: any): boolean {
    const { bridgeApiKey } = requireIbkrBridge();
    if (!bridgeApiKey) return true;
    const providedKey = req.get?.("X-API-KEY") || req.get?.("x-api-key") || "";
    return providedKey === bridgeApiKey;
}

export async function handleManualRequest(
    req: any,
    res: any,
    handler: (symbols?: string[]) => Promise<void>,
    defaultSymbols: string[]
) {
    if (req.method !== "POST") {
        res.set("Allow", "POST").status(405).send("Method Not Allowed");
        return;
    }
    if (!requireApiKey(req)) {
        res.status(401).send("Unauthorized");
        return;
    }
    const symbols = normalizeSymbols(req.body?.symbols || req.query?.symbols);
    try {
        await handler(symbols || undefined);
        res.status(200).json({ ok: true, symbols: symbols || defaultSymbols });
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
}

export function formatYmd(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

export function normalizeDbDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }
    let raw = String(value);
    if (!raw) return null;
    if (raw.includes(' ')) {
        raw = raw.split(' ')[0];
    }
    if (raw.includes('T')) {
        raw = raw.split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
}

export function parseYmdToDate(ymd: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
}

export function diffDays(startYmd: string, endYmd: string) {
    const start = parseYmdToDate(startYmd);
    const end = parseYmdToDate(endYmd);
    if (!start || !end) return 0;
    const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return diff;
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shiftYmd(ymd: string, days: number) {
    const date = parseYmdToDate(ymd);
    if (!date) return ymd;
    date.setUTCDate(date.getUTCDate() + days);
    return formatYmd(date);
}

export function shiftYears(ymd: string, years: number) {
    const date = parseYmdToDate(ymd);
    if (!date) return ymd;
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return formatYmd(date);
}

export function toIbkrEndDateTime(ymd: string) {
    return `${ymd.replace(/-/g, '')} 23:59:59`;
}

/**
 * Calculate RSI (14-period)
 * This is a simplified calculation using available data
 */
export function calculateRSI(closes: number[], period: number = 14): number | null {
    if (closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    // TODO: Need true EMA smoothing for standard RSI, providing simple approximate for now
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
