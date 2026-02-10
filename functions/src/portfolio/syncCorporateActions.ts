import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { fetchWithTimeout } from "@/lib/fetch";

type RawAction = Record<string, any>;

const SPLITS_URL = process.env.POLYGON_SPLITS_URL || "https://api.polygon.io/v3/reference/splits";
const DIVIDENDS_URL = process.env.POLYGON_DIVIDENDS_URL || "https://api.polygon.io/v3/reference/dividends";
const API_KEY = process.env.POLYGON_API_KEY;
const FETCH_TIMEOUT_MS = 30000;
const WINDOW_DAYS = 60;

const buildUrl = (base: string) => {
    const url = new URL(base);
    if (API_KEY && !url.searchParams.get("apiKey")) {
        url.searchParams.set("apiKey", API_KEY);
    }
    return url.toString();
};

const extractResults = (payload: any): RawAction[] => {
    if (Array.isArray(payload)) return payload as RawAction[];
    if (Array.isArray(payload?.results)) return payload.results as RawAction[];
    if (Array.isArray(payload?.data)) return payload.data as RawAction[];
    return [];
};

const normalizeDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
};

const withinWindow = (date: string, now: Date, windowDays: number) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return false;
    const diffDays = Math.abs(parsed.getTime() - now.getTime()) / 86400000;
    return diffDays <= windowDays;
};

const parseRatio = (value: RawAction) => {
    const from = Number(value.split_from ?? value.from ?? value.old_shares);
    const to = Number(value.split_to ?? value.to ?? value.new_shares);
    if (Number.isFinite(from) && Number.isFinite(to) && from > 0) {
        return to / from;
    }
    const ratio = Number(value.ratio ?? value.split_ratio);
    return Number.isFinite(ratio) ? ratio : undefined;
};

const buildActionId = (symbol: string, type: string, date: string) => {
    const safeSymbol = symbol.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${safeSymbol}_${type}_${date}`;
};

const mapSplit = (raw: RawAction, now: Date) => {
    const symbol = String(raw.ticker || raw.symbol || "").trim().toUpperCase();
    if (!symbol) return null;
    const exDate = normalizeDate(raw.ex_date || raw.exDate);
    const effectiveDate = normalizeDate(raw.execution_date || raw.effective_date || raw.declared_date || raw.pay_date);
    const date = effectiveDate || exDate;
    if (!date || !withinWindow(date, now, WINDOW_DAYS)) return null;
    const ratio = parseRatio(raw);
    if (!ratio || !Number.isFinite(ratio)) return null;
    return {
        id: buildActionId(symbol, "split", date),
        symbol,
        type: "split",
        ratio,
        exDate: exDate || undefined,
        effectiveDate: effectiveDate || undefined,
        source: "polygon"
    };
};

const mapDividend = (raw: RawAction, now: Date) => {
    const symbol = String(raw.ticker || raw.symbol || "").trim().toUpperCase();
    if (!symbol) return null;
    const exDate = normalizeDate(raw.ex_date || raw.exDate);
    const payDate = normalizeDate(raw.pay_date || raw.payDate);
    const date = exDate || payDate;
    if (!date || !withinWindow(date, now, WINDOW_DAYS)) return null;
    const cashAmount = Number(raw.cash_amount ?? raw.amount ?? raw.cashAmount);
    return {
        id: buildActionId(symbol, "dividend", date),
        symbol,
        type: "dividend",
        ratio: Number.isFinite(cashAmount) ? cashAmount : undefined,
        exDate: exDate || undefined,
        effectiveDate: payDate || undefined,
        source: "polygon"
    };
};

const fetchCorporateActions = async () => {
    if (!API_KEY) {
        logger.warn("POLYGON_API_KEY missing; skipping corporate actions sync.");
        return [];
    }
    const now = new Date();
    const [splitsRes, dividendsRes] = await Promise.all([
        fetchWithTimeout(buildUrl(SPLITS_URL), {}, FETCH_TIMEOUT_MS),
        fetchWithTimeout(buildUrl(DIVIDENDS_URL), {}, FETCH_TIMEOUT_MS)
    ]);

    const splitsPayload = splitsRes.ok ? await splitsRes.json() : null;
    const dividendsPayload = dividendsRes.ok ? await dividendsRes.json() : null;

    const splits = extractResults(splitsPayload)
        .map((raw) => mapSplit(raw, now))
        .filter((entry): entry is NonNullable<ReturnType<typeof mapSplit>> => Boolean(entry));
    const dividends = extractResults(dividendsPayload)
        .map((raw) => mapDividend(raw, now))
        .filter((entry): entry is NonNullable<ReturnType<typeof mapDividend>> => Boolean(entry));

    return [...splits, ...dividends];
};

const persistCorporateActions = async () => {
    const actions = await fetchCorporateActions();
    if (actions.length === 0) {
        return { written: 0 };
    }
    const db = admin.firestore();
    const batch = db.batch();
    const ref = db.collection("corporate_actions");
    actions.forEach((action) => {
        batch.set(ref.doc(action.id), {
            ...action,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    await batch.commit();
    return { written: actions.length };
};

export const syncCorporateActions = onSchedule({
    schedule: "0 8 * * 1-5",
    timeZone: "America/New_York"
}, async () => {
    const result = await persistCorporateActions();
    logger.info("Corporate actions sync complete", result);
});

export const manualSyncCorporateActions = onCall({
    timeoutSeconds: 60,
    memory: "256MiB"
}, async (request) => {
    if (!request.auth) {
        throw new Error("Must be signed in to sync corporate actions.");
    }
    return persistCorporateActions();
});
