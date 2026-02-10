import { fetchWithTimeout } from "@/lib/fetch";
import { getMarketDataProvider } from "@/lib/marketDataProvider";
import { refreshMarketHolidaysFromPolygon } from "@/lib/marketCalendar";
import type { CalendarEvent } from "./marketCalendarTypes";
import { isValidDate, normalizeImpact, withinWindow } from "./marketCalendarUtils";

const POLYGON_UPCOMING_URL = "https://api.polygon.io/v1/marketstatus/upcoming";

const extractPolygonEvents = (payload: any, now: Date, windowDays: number): CalendarEvent[] => {
    const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

    return rawList
        .map((item: any) => {
            const date = typeof item?.date === "string" ? item.date.slice(0, 10) : "";
            if (!isValidDate(date) || !withinWindow(date, now, windowDays)) return null;
            const status = typeof item?.status === "string" ? item.status : "";
            const name = typeof item?.name === "string" ? item.name : "";
            const holiday = name || status || "Market Holiday";
            const exchange = typeof item?.exchange === "string"
                ? item.exchange
                : Array.isArray(item?.exchanges) && item.exchanges.length > 0
                    ? String(item.exchanges[0])
                    : "NYSE";
            const isOpen = status.toLowerCase().includes("open");
            const earlyClose = status.toLowerCase().includes("early");
            const impact: CalendarEvent["impact"] = earlyClose ? "medium" : "high";
            return {
                date,
                event: holiday,
                holiday,
                market: exchange.toUpperCase(),
                isOpen,
                earlyClose,
                impact,
                source: "polygon"
            } as CalendarEvent;
        })
        .filter((entry: CalendarEvent | null): entry is CalendarEvent => Boolean(entry));
};

const extractMacroEvents = (payload: any, now: Date, windowDays: number): CalendarEvent[] => {
    if (!Array.isArray(payload)) return [];
    return payload
        .map((event: any) => {
            const date = typeof event?.date === "string" ? event.date.slice(0, 10) : "";
            if (!isValidDate(date) || !withinWindow(date, now, windowDays)) return null;
            const title = typeof event?.event === "string" ? event.event : "";
            if (!title) return null;
            const symbols = Array.isArray(event?.symbols)
                ? event.symbols.filter((symbol: unknown) => typeof symbol === "string").map((symbol: string) => symbol.toUpperCase())
                : undefined;
            return {
                date,
                event: title,
                impact: normalizeImpact(event?.impact),
                symbols,
                market: "MACRO",
                isOpen: true,
                source: "macro"
            } as CalendarEvent;
        })
        .filter((entry): entry is CalendarEvent => Boolean(entry));
};

const extractEarningsEvents = async (now: Date, windowDays: number): Promise<CalendarEvent[]> => {
    const provider = getMarketDataProvider();
    const snapshots = await provider.getMarketSnapshot();
    return snapshots
        .filter((snapshot) => snapshot?.earningsDate && withinWindow(snapshot.earningsDate, now, windowDays))
        .map((snapshot) => ({
            date: snapshot.earningsDate as string,
            event: `${snapshot.symbol} Earnings`,
            impact: "high",
            symbols: [snapshot.symbol],
            market: "EARNINGS",
            isOpen: true,
            source: "earnings"
        }));
};

export async function loadPolygonEvents(now: Date, windowDays: number, apiKey: string) {
    try {
        const response = await fetchWithTimeout(`${POLYGON_UPCOMING_URL}?apiKey=${apiKey}`);
        if (response.ok) {
            const payload = await response.json();
            const events = extractPolygonEvents(payload, now, windowDays);
            await refreshMarketHolidaysFromPolygon({ apiKey });
            return events;
        }
        console.warn("Polygon upcoming calendar fetch failed", { status: response.status });
    } catch (error) {
        console.warn("Polygon upcoming calendar fetch error", error);
    }
    return [];
}

export async function loadMacroEvents(now: Date, windowDays: number) {
    const macroUrl = process.env.MACRO_CALENDAR_URL || "";
    if (macroUrl) {
        try {
            const response = await fetchWithTimeout(macroUrl);
            if (response.ok) {
                const payload = await response.json();
                return extractMacroEvents(payload, now, windowDays);
            }
        } catch (error) {
            console.warn("Macro calendar fetch failed", error);
        }
        return [];
    }

    if (process.env.MACRO_CALENDAR_EVENTS) {
        try {
            const payload = JSON.parse(process.env.MACRO_CALENDAR_EVENTS);
            return extractMacroEvents(payload, now, windowDays);
        } catch (error) {
            console.warn("MACRO_CALENDAR_EVENTS parse failed", error);
        }
    }
    return [];
}

export async function loadEarningsEvents(now: Date, windowDays: number) {
    try {
        return await extractEarningsEvents(now, windowDays);
    } catch (error) {
        console.warn("Earnings calendar generation failed", error);
    }
    return [];
}
