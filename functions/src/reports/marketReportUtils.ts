import { ReportData } from "./marketReportTypes";

type KeyDate = ReportData["keyDates"][number];

const KEY_DATE_IMPACT_RANK = {
    low: 0,
    medium: 1,
    high: 2
};

const normalizeKeySymbols = (symbols?: string[]) => {
    if (!symbols) return [];
    return symbols
        .filter((symbol) => typeof symbol === "string")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
};

export function normalizeReportData(raw: unknown): ReportData {
    const fallback: ReportData = {
        headline: "Market Scan Update",
        macroAnalysis: "Market analysis unavailable.",
        keyDates: [],
        vixLevel: 0,
        marketBias: "neutral"
    };

    if (!raw || typeof raw !== "object") {
        return fallback;
    }

    const data = raw as Record<string, unknown>;

    const keyDatesInput = Array.isArray(data.keyDates) ? data.keyDates : [];
    const keyDates = keyDatesInput
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const entry = item as {
                date?: unknown;
                event?: unknown;
                impact?: unknown;
                symbols?: unknown;
            };
            if (typeof entry.date !== "string" || typeof entry.event !== "string") return null;
            const impact = entry.impact === "high" || entry.impact === "medium" || entry.impact === "low"
                ? entry.impact
                : "low";
            const symbols = Array.isArray(entry.symbols)
                ? entry.symbols
                    .filter((symbol) => typeof symbol === "string")
                    .map((symbol) => symbol.trim().toUpperCase())
                    .filter(Boolean)
                : undefined;
            return {
                date: entry.date,
                event: entry.event,
                impact,
                ...(symbols && symbols.length ? { symbols } : {})
            };
        })
        .filter((entry): entry is ReportData["keyDates"][number] => Boolean(entry));

    const vixRaw = data.vixLevel;
    const vixLevel = typeof vixRaw === "number" && Number.isFinite(vixRaw)
        ? vixRaw
        : typeof vixRaw === "string" && vixRaw.trim() !== ""
            ? Number(vixRaw)
            : fallback.vixLevel;

    const marketBiasRaw = data.marketBias;
    const marketBias = marketBiasRaw === "bullish" || marketBiasRaw === "bearish" || marketBiasRaw === "neutral"
        ? marketBiasRaw
        : fallback.marketBias;

    return {
        headline: typeof data.headline === "string" ? data.headline : fallback.headline,
        macroAnalysis: typeof data.macroAnalysis === "string" ? data.macroAnalysis : fallback.macroAnalysis,
        keyDates,
        vixLevel: Number.isFinite(vixLevel) ? vixLevel : fallback.vixLevel,
        marketBias,
        synopsis: typeof data.synopsis === "string" ? data.synopsis : undefined
    };
}

export const mergeKeyDates = (...sources: Array<KeyDate[] | undefined>) => {
    const map = new Map<string, KeyDate>();

    sources.forEach((source) => {
        source?.forEach((entry) => {
            if (!entry?.date || !entry?.event) return;
            const key = `${entry.date}|${entry.event}`.toLowerCase();
            const existing = map.get(key);
            const symbols = normalizeKeySymbols(entry.symbols);
            if (!existing) {
                map.set(key, {
                    ...entry,
                    symbols: symbols.length ? symbols : undefined
                });
                return;
            }
            const mergedSymbols = normalizeKeySymbols([
                ...(existing.symbols || []),
                ...symbols
            ]);
            const incomingRank = KEY_DATE_IMPACT_RANK[entry.impact] ?? 0;
            const existingRank = KEY_DATE_IMPACT_RANK[existing.impact] ?? 0;
            const impact = incomingRank > existingRank
                ? entry.impact
                : existing.impact;
            map.set(key, {
                ...existing,
                ...entry,
                impact,
                symbols: mergedSymbols.length ? mergedSymbols : undefined
            });
        });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const buildCalendarEventsLabel = (events: KeyDate[] = []) => {
    if (!events.length) return "None provided.";
    return events
        .map((entry) => {
            const symbols = entry.symbols?.length ? ` [${entry.symbols.join(", ")}]` : "";
            return `${entry.date} | ${entry.event} | ${entry.impact.toUpperCase()}${symbols}`;
        })
        .join("\n");
};
