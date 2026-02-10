import type { CalendarEvent } from "./marketCalendarTypes";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const isValidDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);

export const withinWindow = (date: string, now: Date, windowDays: number) => {
    if (!isValidDate(date)) return false;
    const diff = toDate(date).getTime() - now.getTime();
    return diff >= -DAY_MS && diff <= (windowDays * DAY_MS);
};

export const normalizeImpact = (value?: string): CalendarEvent["impact"] => {
    if (!value) return "low";
    const lowered = value.toLowerCase();
    if (lowered === "high" || lowered === "medium" || lowered === "low") return lowered;
    return "low";
};

export const buildDocId = (entry: CalendarEvent) => {
    const base = `${entry.date}_${entry.market || "market"}_${entry.event || entry.holiday || "event"}`;
    return base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
};

export const mergeEvents = (...lists: CalendarEvent[][]) => {
    const map = new Map<string, CalendarEvent>();
    lists.flat().forEach((entry) => {
        if (!entry?.date || !(entry.event || entry.holiday)) return;
        const key = `${entry.date}|${entry.market || ""}|${entry.event || entry.holiday}`.toLowerCase();
        const existing = map.get(key);
        if (!existing) {
            map.set(key, entry);
            return;
        }
        const symbols = [...new Set([...(existing.symbols || []), ...(entry.symbols || [])])];
        map.set(key, {
            ...existing,
            ...entry,
            symbols: symbols.length ? symbols : undefined
        });
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};
