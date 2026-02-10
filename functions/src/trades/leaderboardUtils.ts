import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { parseOsiSymbol } from "@/lib/publicMarketDataUtils";

export type LeaderboardEntry = {
    userId: string;
    displayName: string;
    yieldPct: number;
    tradeCount: number;
};

export const toNumber = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseDate = (value?: unknown) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
        const parsed = (value as { toDate: () => Date }).toDate();
        if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
    }
    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (/^\\d{8}$/.test(trimmed)) {
        const year = trimmed.slice(0, 4);
        const month = trimmed.slice(4, 6);
        const day = trimmed.slice(6, 8);
        const iso = `${year}-${month}-${day}T00:00:00Z`;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDisplayName = (displayName?: string, email?: string, uid?: string) => {
    const base = (displayName || "").trim() || (email || "").trim();
    if (!base) {
        return uid ? `Trader ${uid.slice(0, 6).toUpperCase()}` : "Trader";
    }
    const parts = base.split(/\\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${parts[0]} ${lastInitial}.`;
};

const toUpper = (value?: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "");
const normalizeRight = (value?: unknown) => {
    const raw = toUpper(value);
    if (!raw || raw === "?" || raw === "N/A" || raw === "NA") return "";
    if (raw === "CALL") return "C";
    if (raw === "PUT") return "P";
    return raw;
};

export const resolveOptionTrade = (trade: Record<string, any>) => {
    const raw = trade.raw as Record<string, unknown> | undefined;
    const rawLocalSymbol = trade.localSymbol ?? raw?.localSymbol;
    const parsedLocal = parseOsiSymbol(rawLocalSymbol ? String(rawLocalSymbol) : undefined);
    const secType = toUpper(trade.secType ?? raw?.secType);
    const right = normalizeRight(trade.right ?? raw?.right ?? parsedLocal?.right);
    const symbol = toUpper(trade.symbol ?? raw?.symbol ?? parsedLocal?.root);
    const strike = toNumber(trade.strike ?? raw?.strike ?? parsedLocal?.strike);
    const expirationRaw = trade.expiration ?? raw?.expiration ?? raw?.lastTradeDateOrContractMonth ?? parsedLocal?.expiration;
    const expiration = expirationRaw ? parseDate(expirationRaw) : null;
    const multiplier = toNumber(trade.multiplier ?? raw?.multiplier) ?? 100;
    const isOption = secType === "OPT" || Boolean(right) || Number.isFinite(strike ?? NaN) || Boolean(expiration);
    if (!isOption || !symbol || !right || !strike || !expiration) return null;

    const sideRaw = toUpper(trade.type ?? trade.side ?? raw?.side ?? raw?.action);
    const side = sideRaw === "SELL" || sideRaw === "SLD"
        ? "SELL"
        : sideRaw === "BUY" || sideRaw === "BOT"
            ? "BUY"
            : null;
    if (!side) return null;

    let price = toNumber(
        trade.price
        ?? trade.avgPrice
        ?? raw?.price
        ?? raw?.avgPrice
        ?? raw?.executionPrice
    );
    const quantity = Math.abs(toNumber(
        trade.quantity
        ?? trade.shares
        ?? raw?.shares
        ?? raw?.cumQty
        ?? raw?.quantity
    ) ?? 0);
    const total = toNumber(trade.total ?? raw?.total);
    const resolvedMultiplier = toNumber(trade.multiplier ?? raw?.multiplier) ?? multiplier;
    if (!price || price <= 0) {
        if (total && quantity > 0 && resolvedMultiplier > 0) {
            price = Math.abs(total) / (quantity * resolvedMultiplier);
        }
    }
    const commission = toNumber(trade.commission ?? raw?.commission) ?? 0;
    const tradeDate = parseDate(trade.date ?? trade.tradeDate ?? raw?.time ?? raw?.tradeDate ?? raw?.tradeDateTime ?? "");
    if (!price || !quantity || !tradeDate) return null;

    const key = `${symbol}|${right}|${strike}|${expiration.toISOString()}|${multiplier}`;

    return {
        key,
        side,
        price,
        quantity,
        commission,
        tradeDate,
        strike,
        expiration,
        multiplier
    };
};

type ResolvedOptionTrade = NonNullable<ReturnType<typeof resolveOptionTrade>>;

export const clampYield = (value: number) => Math.min(500, Math.max(-500, value));

export const loadTtodBotEntry = async (db: admin.firestore.Firestore): Promise<LeaderboardEntry | null> => {
    try {
        const snapshot = await db.collection("opportunities").get();
        const opportunities = snapshot.docs
            .filter((doc) => doc.id !== "metadata")
            .map((doc) => doc.data() as Record<string, any>)
            .filter((doc) => typeof doc?.symbol === "string");

        const top = opportunities
            .filter((doc) => Number.isFinite(Number(doc.annualizedYield)))
            .sort((a, b) => Number(b.annualizedYield) - Number(a.annualizedYield))[0];

        if (!top || !top.symbol) return null;

        return {
            userId: "bot_ttod",
            displayName: "TTOD Bot",
            yieldPct: Number(top.annualizedYield),
            tradeCount: 1
        };
    } catch (error) {
        logger.warn("Failed to load TTOD bot entry", error);
        return null;
    }
};

export const computeClosedOptionYields = (trades: Record<string, any>[], now: Date) => {
    const tradesByKey = new Map<string, ResolvedOptionTrade[]>();

    trades.forEach((trade) => {
        const optionTrade = resolveOptionTrade(trade);
        if (!optionTrade) return;
        const list = tradesByKey.get(optionTrade.key) || [];
        list.push(optionTrade);
        tradesByKey.set(optionTrade.key, list);
    });

    const yields: number[] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    tradesByKey.forEach((list) => {
        if (list.length === 0) return;
        const ordered = [...list].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
        const first = ordered[0];
        if (!first) return;
        let openQty = 0;
        let cycleQty = 0;
        let cycleCredit = 0;
        let cycleStart: Date | null = null;
        const { strike, expiration, multiplier } = first;

        const closeCycle = (closeDate: Date) => {
            if (!cycleStart || cycleQty <= 0) return;
            const daysHeld = Math.max(1, Math.ceil((closeDate.getTime() - cycleStart.getTime()) / dayMs));
            const collateral = strike * multiplier * cycleQty;
            if (collateral <= 0) return;
            const annualizedYield = (cycleCredit / collateral) * (365 / daysHeld) * 100;
            yields.push(clampYield(annualizedYield));
            cycleStart = null;
            cycleQty = 0;
            cycleCredit = 0;
        };

        ordered.forEach((trade) => {
            if (trade.side === "SELL") {
                if (openQty === 0) {
                    cycleStart = trade.tradeDate;
                    cycleQty = 0;
                    cycleCredit = 0;
                }
                openQty += trade.quantity;
                cycleQty += trade.quantity;
                cycleCredit += trade.price * trade.quantity * trade.multiplier;
                if (trade.commission) {
                    cycleCredit -= trade.commission;
                }
                return;
            }

            if (openQty <= 0) {
                return;
            }

            const offset = Math.min(openQty, trade.quantity);
            cycleCredit -= trade.price * offset * trade.multiplier;
            if (trade.commission) {
                cycleCredit -= trade.commission;
            }
            openQty -= offset;
            if (openQty === 0) {
                closeCycle(trade.tradeDate);
            }
        });

        if (openQty > 0 && expiration.getTime() <= now.getTime()) {
            closeCycle(expiration);
        }
    });

    return yields;
};
