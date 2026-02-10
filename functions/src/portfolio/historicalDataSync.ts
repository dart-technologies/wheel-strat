import { getDB } from "@/lib/cloudsql";
import { insertHistoricalRows, insertIntradayRows } from "@/lib/dbInsertPolicy";
import { fetchIbkrHistoricalBars, HistoricalFetchConfig } from "@/lib/ibkrHistorical";
import {
    DAILY_BACKFILL_YEARS,
    DAILY_BAR_SIZE,
    DAILY_GAP_BUFFER_DAYS,
    DAILY_MAX_DAYS,
    DAILY_SEED_DURATION,
    DAILY_USE_RTH,
    DAILY_WHAT_TO_SHOW,
    INTRADAY_BAR_SIZE,
    INTRADAY_DURATION,
    INTRADAY_USE_RTH,
    INTRADAY_WHAT_TO_SHOW
} from "./historicalDataConfig";
import {
    calculateRSI,
    diffDays,
    normalizeDbDate,
    shiftYmd,
    shiftYears,
    toIbkrEndDateTime
} from "./historicalDataUtils";

export async function fetchHistoricalBars(
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    config: HistoricalFetchConfig
) {
    return fetchIbkrHistoricalBars(bridgeUrl, bridgeApiKey, config, 60000);
}

export async function upsertTechnicals(symbol: string, date: string) {
    const db = getDB();
    const history = await db("historical_prices")
        .where({ symbol })
        .orderBy("date", "desc")
        .limit(200);

    if (history.length < 14) return;

    const closes = history.map((row) => Number(row.close)).reverse();
    const rsi = calculateRSI(closes);
    if (rsi === null) return;

    await db("technical_indicators")
        .insert({
            symbol,
            date,
            rsi_14: rsi,
            sma_20: history.length >= 20
                ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20
                : null,
            sma_50: history.length >= 50
                ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50
                : null,
            sma_200: history.length >= 200
                ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
                : null,
        })
        .onConflict(["symbol", "date"])
        .merge();
}

export async function syncDailyBars(
    symbol: string,
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    todayEastern: string
) {
    const db = getDB();
    const latestRow = await db("historical_prices").where({ symbol }).max("date as max").first();
    const earliestRow = await db("historical_prices").where({ symbol }).min("date as min").first();
    const latestDate = normalizeDbDate(latestRow?.max);
    const earliestDate = normalizeDbDate(earliestRow?.min);
    const adjusted = DAILY_WHAT_TO_SHOW.toUpperCase() === "ADJUSTED_LAST";
    const duration = !latestDate
        ? DAILY_SEED_DURATION
        : `${Math.min(diffDays(latestDate, todayEastern) + DAILY_GAP_BUFFER_DAYS, DAILY_MAX_DAYS)} D`;

    if (!latestDate || diffDays(latestDate, todayEastern) > 0) {
        const bars = await fetchHistoricalBars(bridgeUrl, bridgeApiKey, {
            symbol,
            barSize: DAILY_BAR_SIZE,
            duration,
            whatToShow: DAILY_WHAT_TO_SHOW,
            useRTH: DAILY_USE_RTH
        });
        const rows = bars
            .filter((bar) => bar.date && bar.close !== null)
            .map((bar) => ({
                symbol,
                date: bar.date,
                open: bar.open ?? bar.close,
                high: bar.high ?? bar.close,
                low: bar.low ?? bar.close,
                close: bar.close,
                volume: bar.volume,
                adjusted,
                source: "ibkr"
            }));
        if (rows.length) {
            await insertHistoricalRows(db, rows);
            const latestBar = rows[rows.length - 1];
            if (latestBar?.date) {
                await upsertTechnicals(symbol, latestBar.date);
            }
        }
    }

    if (DAILY_BACKFILL_YEARS > 0 && earliestDate) {
        const targetStart = shiftYears(todayEastern, -DAILY_BACKFILL_YEARS);
        if (earliestDate > targetStart) {
            const endDate = shiftYmd(earliestDate, -1);
            if (endDate >= targetStart) {
                const backfillDays = Math.min(diffDays(targetStart, endDate), DAILY_MAX_DAYS);
                if (backfillDays > 0) {
                    const endDateTime = `${endDate.replace(/-/g, "")} 23:59:59`;
                    const bars = await fetchHistoricalBars(bridgeUrl, bridgeApiKey, {
                        symbol,
                        barSize: DAILY_BAR_SIZE,
                        duration: `${backfillDays} D`,
                        endDateTime,
                        whatToShow: DAILY_WHAT_TO_SHOW,
                        useRTH: DAILY_USE_RTH
                    });
                    const rows = bars
                        .filter((bar) => bar.date && bar.close !== null)
                        .map((bar) => ({
                            symbol,
                            date: bar.date,
                            open: bar.open ?? bar.close,
                            high: bar.high ?? bar.close,
                            low: bar.low ?? bar.close,
                            close: bar.close,
                            volume: bar.volume,
                            adjusted,
                            source: "ibkr"
                        }));
                    if (rows.length) {
                        await insertHistoricalRows(db, rows);
                    }
                }
            }
        }
    }
}

export async function syncIntradayBars(
    symbol: string,
    bridgeUrl: string,
    bridgeApiKey: string | undefined,
    endDate?: string
) {
    const db = getDB();
    const endDateTime = endDate ? toIbkrEndDateTime(endDate) : undefined;
    const bars = await fetchHistoricalBars(bridgeUrl, bridgeApiKey, {
        symbol,
        barSize: INTRADAY_BAR_SIZE,
        duration: INTRADAY_DURATION,
        whatToShow: INTRADAY_WHAT_TO_SHOW,
        useRTH: INTRADAY_USE_RTH,
        endDateTime
    });
    const adjusted = INTRADAY_WHAT_TO_SHOW.toUpperCase() === "ADJUSTED_LAST";
    const rows = bars
        .filter((bar) => bar.date && bar.close !== null)
        .map((bar) => ({
            symbol,
            timestamp: bar.date,
            bar_size: INTRADAY_BAR_SIZE,
            open: bar.open ?? bar.close,
            high: bar.high ?? bar.close,
            low: bar.low ?? bar.close,
            close: bar.close,
            volume: bar.volume,
            regular_trading_hours: INTRADAY_USE_RTH,
            adjusted,
            source: "ibkr"
        }));
    if (rows.length) {
        await insertIntradayRows(db, rows);
    }
}
