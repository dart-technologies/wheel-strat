import { fetchWithTimeout } from "@/lib/fetch";
import { getDB } from "@/lib/cloudsql";
import { ibkrMarketQuoteSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import { INTRADAY_BAR_SIZE, INTRADAY_USE_RTH } from "./backtestPipelineConfig";
import { buildPriceBars } from "./backtestPipelineSeries";
import { applySplitAdjustments, loadSplitFactors } from "./backtestPipelineSplits";

export async function fetchIbkrQuote(
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    symbol: string
) {
    const res = await fetchWithTimeout(
        `${bridgeUrl.replace(/\/+$/, "")}/market-data/${symbol}`,
        { method: "GET" },
        15000,
        bridgeApiKey
    );
    if (!res.ok) return null;
    const rawPayload = await res.json();
    return parseIbkrResponse(ibkrMarketQuoteSchema, rawPayload, `market-data/${symbol}`);
}

export async function loadDailyBars(symbol: string, limit?: number) {
    const db = getDB();
    let query = db("historical_prices").where({ symbol, adjusted: false }).orderBy("date", "asc");
    if (limit) {
        query = query.limit(limit);
    }
    const rows = await query;
    const bars = buildPriceBars(rows, "date");
    const splitFactors = await loadSplitFactors(symbol);
    return applySplitAdjustments(bars, splitFactors);
}

export async function loadIntradayBars(symbol: string, lookbackDays: number) {
    const db = getDB();
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const rows = await db("intraday_prices")
        .where({
            symbol,
            bar_size: INTRADAY_BAR_SIZE,
            regular_trading_hours: INTRADAY_USE_RTH,
            adjusted: false
        })
        .andWhere("timestamp", ">=", since)
        .orderBy("timestamp", "asc");
    const bars = buildPriceBars(rows, "timestamp");
    const splitFactors = await loadSplitFactors(symbol);
    return applySplitAdjustments(bars, splitFactors);
}

export async function fetchScenarioBars(symbol: string, start: string, end: string) {
    const db = getDB();
    const rows = await db("historical_prices")
        .where({ symbol, adjusted: false })
        .andWhere("date", ">=", start)
        .andWhere("date", "<=", end)
        .orderBy("date", "asc");
    const bars = buildPriceBars(rows, "date");
    const splitFactors = await loadSplitFactors(symbol);
    return applySplitAdjustments(bars, splitFactors).bars;
}
