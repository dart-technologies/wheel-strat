import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";

import { getEasternDate, isMarketDay } from "@wheel-strat/shared";
import { getDB, initSchema, isDbConfigured, resolveDbConnection } from "@/lib/cloudsql";
import { insertIntradayRows } from "@/lib/dbInsertPolicy";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { HistoricalRepository } from "@/lib/historicalRepository";
import {
    INTRADAY_BAR_SIZE,
    INTRADAY_ENABLED,
    INTRADAY_GAP_ENABLED,
    INTRADAY_GAP_LOOKBACK_DAYS,
    INTRADAY_GAP_MAX_DAYS,
    INTRADAY_GAP_SLEEP_MS,
    INTRADAY_USE_RTH,
    INTRADAY_WHAT_TO_SHOW,
    WATCHLIST
} from "./historicalDataConfig";
import {
    formatYmd,
    handleManualRequest,
    normalizeDbDate,
    sleep,
    toIbkrEndDateTime
} from "./historicalDataUtils";
import { fetchHistoricalBars, syncDailyBars, syncIntradayBars } from "./historicalDataSync";


async function findMissingIntradayDates(
    symbol: string,
    lookbackDays: number,
    maxDays: number
) {
    const db = getDB();
    const interval = `${lookbackDays} days`;
    const result = await db.raw(
        `with daily as (
            select date
              from historical_prices
             where symbol = ?
               and date >= (current_date - ?::interval)
         ),
         intraday as (
            select distinct date(timestamp) as date
              from intraday_prices
             where symbol = ?
               and timestamp >= (now() - ?::interval)
         )
         select daily.date
           from daily
           left join intraday using (date)
          where intraday.date is null
          order by daily.date desc`,
        [symbol, interval, symbol, interval]
    );

    const rows = Array.isArray(result) ? result : (result?.rows || []);
    let missingDates = rows
        .map((row: any) => normalizeDbDate(row?.date))
        .filter(Boolean) as string[];

    if (maxDays > 0) {
        missingDates = missingDates.slice(0, maxDays);
    }

    return missingDates;
}

async function repairIntradayGapsInternal(symbols?: string[]) {
    if (!INTRADAY_GAP_ENABLED) return;
    if (!isDbConfigured()) {
        console.warn('Database not configured; skipping intraday gap repair.');
        return;
    }

    const { bridgeUrl, bridgeApiKey, bridgeUrlConfigured } = requireIbkrBridge();
    if (!bridgeUrlConfigured) {
        console.warn('IBKR bridge not configured; skipping intraday gap repair.');
        return;
    }

    await initSchema();
    const db = getDB();
    const targetSymbols = symbols?.length ? symbols : WATCHLIST;
    const adjusted = INTRADAY_WHAT_TO_SHOW.toUpperCase() === 'ADJUSTED_LAST';

    for (const symbol of targetSymbols) {
        try {
            const missingDates = await findMissingIntradayDates(
                symbol,
                INTRADAY_GAP_LOOKBACK_DAYS,
                INTRADAY_GAP_MAX_DAYS
            );
            if (!missingDates.length) continue;

            console.log(`Repairing intraday gaps for ${symbol}: ${missingDates.length} day(s).`);
            for (const missing of missingDates) {
                const bars = await fetchHistoricalBars(bridgeUrl, bridgeApiKey, {
                    symbol,
                    barSize: INTRADAY_BAR_SIZE,
                    duration: '1 D',
                    endDateTime: toIbkrEndDateTime(missing),
                    whatToShow: INTRADAY_WHAT_TO_SHOW,
                    useRTH: INTRADAY_USE_RTH
                });
                const rows = bars
                    .filter((bar) => bar.timestamp && bar.close !== null)
                    .map((bar) => ({
                        symbol,
                        timestamp: bar.timestamp,
                        bar_size: INTRADAY_BAR_SIZE,
                        open: bar.open ?? bar.close,
                        high: bar.high ?? bar.close,
                        low: bar.low ?? bar.close,
                        close: bar.close,
                        volume: bar.volume,
                        regular_trading_hours: INTRADAY_USE_RTH,
                        adjusted,
                        source: 'ibkr'
                    }));

                if (rows.length) {
                    await insertIntradayRows(db, rows);
                }

                if (INTRADAY_GAP_SLEEP_MS > 0) {
                    await sleep(INTRADAY_GAP_SLEEP_MS);
                }
            }
        } catch (error) {
            console.warn(`Intraday gap repair failed for ${symbol}:`, error);
        }
    }
}

/**
 * Historical Data Sync (Gap Fill + Optional Backfill)
 * Runs daily at 5:00 PM ET to capture end-of-day data
 */
export const syncHistoricalData = onSchedule({
    schedule: '0 17 * * 1-5', // 5:00 PM Mon-Fri
    timeZone: 'America/New_York'
}, async () => {
    const { bridgeUrl, bridgeApiKey, tradingMode, bridgeUrlConfigured, isEmulator } = requireIbkrBridge();
    console.log('📚 Syncing historical data...');
    if (!isEmulator && !bridgeUrlConfigured) {
        console.warn('IBKR_BRIDGE_URL not configured; skipping historical data sync.');
        return;
    }
    if (!isDbConfigured()) {
        console.warn('Database not configured; skipping historical data sync.');
        return;
    }

    const connection = resolveDbConnection();
    console.log(`📡 Connecting to DB via: ${JSON.stringify(connection)}`);
    await initSchema();

    const easternToday = formatYmd(getEasternDate(new Date()));
    if (!isMarketDay(new Date())) {
        console.log(`📆 Not a market day (${easternToday}); will still attempt gap-fill.`);
    }
    const resolvedBridgeUrl = bridgeUrl;
    console.log(`Trading mode: ${tradingMode}`);

    for (const symbol of WATCHLIST) {
        try {
            await syncDailyBars(symbol, resolvedBridgeUrl, bridgeApiKey, easternToday);
            if (INTRADAY_ENABLED) {
                await syncIntradayBars(symbol, resolvedBridgeUrl, bridgeApiKey);
            }
        } catch (error) {
            console.error(`Error syncing ${symbol}:`, error);
        }
    }

    console.log('📚 Historical sync complete');
});

export const repairIntradayGaps = onSchedule({
    schedule: '25 17 * * 1-5',
    timeZone: 'America/New_York',
    memory: '1GiB',
    timeoutSeconds: 540
}, async () => {
    await repairIntradayGapsInternal();
});

export const repairIntradayGapsManual = onRequest(async (req, res) => {
    await handleManualRequest(req, res, repairIntradayGapsInternal, WATCHLIST);
});

export const getHistoricalBars = onCall(async (request) => {
    const symbolRaw = request.data?.symbol;
    if (!symbolRaw || typeof symbolRaw !== 'string') {
        throw new HttpsError('invalid-argument', 'symbol is required');
    }

    const limit = typeof request.data?.limit === 'number' ? request.data.limit : undefined;
    const startDate = typeof request.data?.startDate === 'string' ? request.data.startDate : undefined;
    const endDate = typeof request.data?.endDate === 'string' ? request.data.endDate : undefined;

    const repo = new HistoricalRepository();
    const result = await repo.getHistoricalBars(symbolRaw, { limit, startDate, endDate });
    if (!result || !result.bars.length) {
        throw new HttpsError('not-found', `No historical data for ${symbolRaw}`);
    }

    return {
        symbol: result.symbol,
        count: result.bars.length,
        source: result.source,
        bars: result.bars
    };
});
