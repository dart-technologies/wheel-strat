import { requireIbkrBridge } from "@/lib/ibkrGuards";

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

export function parseForceFlag(req: any) {
    const raw = req.body?.force ?? req.query?.force;
    if (raw === undefined) return false;
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).trim().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(normalized);
}

export async function handleManualRequest(
    req: any,
    res: any,
    handler: (symbols?: string[]) => Promise<void>,
    fallbackSymbols: string[]
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
        res.status(200).json({ ok: true, symbols: symbols || fallbackSymbols });
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
}

export function parseNumberEnv(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseBooleanEnv(value: string | undefined, fallback: boolean) {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
}

export function formatYmd(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

export function parseExpirationDate(expiration: string) {
    if (!expiration) return null;
    const normalized = expiration.replace(/-/g, '');
    if (!/^\d{8}$/.test(normalized)) return null;
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));
    return new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
}

export function pickExpiration(expirations: string[]) {
    return expirations.find((exp) => {
        const expDate = parseExpirationDate(exp);
        if (!expDate) return false;
        const days = Math.ceil((expDate.getTime() - Date.now()) / 86400000);
        return days >= 14 && days <= 45;
    }) || expirations[0];
}

export function pickStrike(strikes: number[], currentPrice: number) {
    const sorted = [...strikes].sort((a, b) => a - b);
    let closest = sorted[0];
    let minDiff = Math.abs(sorted[0] - currentPrice);
    for (const strike of sorted) {
        const diff = Math.abs(strike - currentPrice);
        if (diff < minDiff) {
            minDiff = diff;
            closest = strike;
        }
    }
    return closest;
}
