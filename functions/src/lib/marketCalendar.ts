import { mergeNYSEHolidays } from "@wheel-strat/shared";
import { fetchWithTimeout } from "./fetch";

type PolygonMarketStatus = {
    date?: string;
    status?: string;
    exchange?: string;
    exchanges?: string[];
};

type MarketHolidayUpdate = {
    updated: boolean;
    holidaysByYear?: Record<number, string[]>;
    reason?: string;
};

const POLYGON_UPCOMING_URL = "https://api.polygon.io/v1/marketstatus/upcoming";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const HOLIDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RELEVANT_EXCHANGES = ["NYSE", "NASDAQ", "CBOE"];

let lastRefreshAt = 0;
let cachedByYear: Record<number, string[]> | null = null;
let inflight: Promise<MarketHolidayUpdate> | null = null;

const normalizeDate = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim().slice(0, 10);
    if (!HOLIDAY_PATTERN.test(trimmed)) return null;
    return trimmed;
};

const isRelevantExchange = (event: PolygonMarketStatus) => {
    const exchanges = Array.isArray(event.exchanges) ? event.exchanges : [];
    const exchange = typeof event.exchange === "string" ? event.exchange : "";
    const candidates = exchanges.length > 0 ? exchanges : exchange ? [exchange] : [];
    if (candidates.length === 0) return true;
    return candidates.some((entry) => {
        const upper = entry.toUpperCase();
        return RELEVANT_EXCHANGES.some((match) => upper.includes(match));
    });
};

const isHolidayStatus = (status?: string) => {
    if (!status) return false;
    const normalized = status.toLowerCase();
    if (normalized.includes("open")) return false;
    return normalized.includes("closed") || normalized.includes("holiday");
};

const extractEvents = (payload: any): PolygonMarketStatus[] => {
    if (Array.isArray(payload)) return payload as PolygonMarketStatus[];
    if (Array.isArray(payload?.results)) return payload.results as PolygonMarketStatus[];
    if (Array.isArray(payload?.data)) return payload.data as PolygonMarketStatus[];
    if (Array.isArray(payload?.upcoming)) return payload.upcoming as PolygonMarketStatus[];
    return [];
};

const buildHolidayMap = (events: PolygonMarketStatus[]) => {
    const map: Record<number, string[]> = {};
    events.forEach((event) => {
        if (!isRelevantExchange(event)) return;
        if (!isHolidayStatus(event.status)) return;
        const date = normalizeDate(event.date);
        if (!date) return;
        const year = Number(date.slice(0, 4));
        if (!Number.isFinite(year)) return;
        if (!map[year]) map[year] = [];
        map[year].push(date);
    });
    Object.keys(map).forEach((yearKey) => {
        const year = Number(yearKey);
        const unique = Array.from(new Set(map[year] || [])).sort();
        map[year] = unique;
    });
    return map;
};

export async function refreshMarketHolidaysFromPolygon(options: {
    apiKey?: string;
    now?: Date;
    ttlMs?: number;
} = {}): Promise<MarketHolidayUpdate> {
    const apiKey = options.apiKey;
    if (!apiKey) {
        return { updated: false, reason: "missing-api-key" };
    }

    const now = options.now ?? new Date();
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    if (lastRefreshAt && (now.getTime() - lastRefreshAt) < ttlMs) {
        return {
            updated: false,
            holidaysByYear: cachedByYear ?? undefined,
            reason: "fresh-cache",
        };
    }

    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const res = await fetchWithTimeout(`${POLYGON_UPCOMING_URL}?apiKey=${apiKey}`);
            if (!res.ok) {
                return { updated: false, reason: `http-${res.status}` };
            }
            const payload = await res.json();
            const events = extractEvents(payload);
            const holidayMap = buildHolidayMap(events);
            if (Object.keys(holidayMap).length > 0) {
                mergeNYSEHolidays(holidayMap);
                cachedByYear = holidayMap;
                lastRefreshAt = now.getTime();
                return { updated: true, holidaysByYear: holidayMap };
            }
            return { updated: false, reason: "empty-response" };
        } catch (error) {
            console.warn("[marketCalendar] Holiday refresh failed:", error);
            return { updated: false, reason: "error" };
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

export function bootstrapMarketCalendar() {
    const apiKey = process.env.POLYGON_API_KEY || process.env.EXPO_PUBLIC_POLYGON_API_KEY;
    if (!apiKey) return;
    void refreshMarketHolidaysFromPolygon({ apiKey });
}
