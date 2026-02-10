import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import type { MarketSnapshot } from "@/lib/marketDataProvider";

// Helper to calculate days to earnings
export function calculateDaysToEarnings(earningsDate?: string): string {
    if (!earningsDate) return "N/A";
    const eventDate = new Date(earningsDate);
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toString();
}

export type KeyDate = {
    date: string;
    event: string;
    impact: "high" | "medium" | "low";
    symbols?: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseYmdDate = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildUpcomingEarningsKeyDates = (
    snapshots: MarketSnapshot[],
    now: Date,
    windowDays = 7
): KeyDate[] => {
    const entries = new Map<string, KeyDate>();
    snapshots.forEach((snapshot) => {
        if (!snapshot?.earningsDate || !snapshot.symbol) return;
        const date = parseYmdDate(snapshot.earningsDate);
        if (!date) return;
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
        if (diffDays < 0 || diffDays > windowDays) return;
        const symbol = snapshot.symbol.toUpperCase();
        const key = `${snapshot.earningsDate}|${symbol}`;
        entries.set(key, {
            date: snapshot.earningsDate,
            event: `${symbol} Earnings`,
            impact: "high",
            symbols: [symbol],
        });
    });
    return Array.from(entries.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const buildTrackRecordSnippet = async (
    db: admin.firestore.Firestore,
    symbol: string
) => {
    try {
        const snapshot = await db.collection("prediction_history")
            .where("symbol", "==", symbol.toUpperCase())
            .orderBy("evaluatedAt", "desc")
            .limit(10)
            .get();
        if (snapshot.empty) return "No prior prediction history.";
        const entries = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
        const wins = entries.filter((entry) => entry.outcome === "win" || entry.success === true).length;
        const losses = entries.filter((entry) => entry.outcome === "loss" || entry.success === false).length;
        const lastOutcome = typeof entries[0]?.outcome === "string" ? entries[0].outcome : null;
        const base = `Recent ${entries.length} outcomes for ${symbol.toUpperCase()}: ${wins} wins / ${losses} losses.`;
        return lastOutcome ? `${base} Last: ${lastOutcome}.` : base;
    } catch (error) {
        logger.warn("Track record lookup failed.", { symbol, error });
        return "No prior prediction history.";
    }
};
