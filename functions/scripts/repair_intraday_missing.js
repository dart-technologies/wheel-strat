#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs, parseBoolean, parseNumber } = require('./lib/args');
const { connectDb, setForceUpdate } = require('./lib/db');
const { buildInsertQuery } = require('./lib/insertPolicy');
const { createLogger } = require('./lib/logger');
const { runDateListIngest } = require('./lib/ingestEngine');
const { fetchIbkrHistoricalBars } = require('./lib/ibkrHistorical');

const {
    getBridgeUrl,
    getBridgeApiKey
} = require('../../scripts/lib/ibkrBridgeConfig');

const logger = createLogger('repair-intraday');

function formatYmd(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function toIbkrEndDateTime(date) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')} 23:59:59`;
}

function normalizeMissingDate(value) {
    if (!value) return null;
    if (value instanceof Date) return formatYmd(value);
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (raw.includes('T')) return raw.split('T')[0];
    return null;
}

const IBKR_TIMEOUT_MS = 90000;

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbol = String(args.symbol || 'AMZN').toUpperCase();
    const barSize = args['bar-size'] || '1 min';
    const whatToShow = args['what-to-show'] || 'TRADES';
    const lookbackDays = parseNumber(args['lookback-days'], 730);
    const maxDays = parseNumber(args['max-days'], 0);
    const useRTH = parseBoolean(args['use-rth'], true);
    const sleepMs = parseNumber(args['sleep-ms'], 900);
    const dryRun = Boolean(args['dry-run']);
    const timeoutMs = parseNumber(args['timeout-ms'], 90000);
    const forceUpsert = parseBoolean(args.force, false) || parseBoolean(args['force-upsert'], false);

    const explicitBridgeUrl = args['bridge-url'];
    const bridgeUrl = getBridgeUrl(process.env, explicitBridgeUrl);
    const apiKey = getBridgeApiKey(process.env, args['api-key']);
    if (!bridgeUrl || !/^https?:\/\//i.test(bridgeUrl)) {
        logger.error(`Bridge URL not resolved. Got: ${bridgeUrl || 'empty'}`);
        process.exit(1);
    }
    if (!apiKey) {
        logger.error('Missing IBKR bridge API key.');
        process.exit(1);
    }

    const client = await connectDb();
    await setForceUpdate(client, forceUpsert);
    if (forceUpsert) {
        logger.warn('Force upsert enabled for intraday_prices.');
    }

    const missingRes = await client.query(
        `with daily as (
            select date
              from historical_prices
             where symbol = $1
               and date >= (current_date - $2::interval)
         ),
         intraday as (
            select distinct date(timestamp) as date
              from intraday_prices
             where symbol = $1
               and timestamp >= (now() - $2::interval)
         )
         select daily.date
           from daily
           left join intraday using (date)
          where intraday.date is null
          order by daily.date desc`,
        [symbol, `${lookbackDays} days`]
    );

    let missingDates = missingRes.rows
        .map((row) => normalizeMissingDate(row.date))
        .filter(Boolean);

    if (maxDays > 0) {
        missingDates = missingDates.slice(0, maxDays);
    }

    logger.info(`Missing intraday days for ${symbol} (lookback ${lookbackDays}d): ${missingDates.length}`);
    if (!missingDates.length) {
        await client.end();
        return;
    }

    const normalizedBridge = bridgeUrl.replace(/\/+$/, '');
    const insertRows = async (rows) => {
        const { query, values } = buildInsertQuery({
            table: 'intraday_prices',
            columns: [
                'symbol',
                'timestamp',
                'bar_size',
                'open',
                'high',
                'low',
                'close',
                'volume',
                'regular_trading_hours',
                'adjusted',
                'source'
            ],
            rows,
            conflictColumns: ['symbol', 'timestamp', 'bar_size', 'regular_trading_hours', 'adjusted'],
            updateColumns: ['open', 'high', 'low', 'close', 'volume', 'source'],
            allowUpdate: forceUpsert
        });
        await client.query(query, values);
    };

    await runDateListIngest({
        symbol,
        barSize,
        whatToShow,
        useRTH,
        dates: missingDates,
        sleepMs,
        dryRun,
        fetchBars: async (payload) => {
            return fetchIbkrHistoricalBars(normalizedBridge, apiKey, payload, timeoutMs || IBKR_TIMEOUT_MS);
        },
        mapBars: (bars) => bars
            .map((bar) => {
                return {
                    symbol,
                    timestamp: bar.timestamp,
                    bar_size: barSize,
                    open: Number.isFinite(Number(bar.open)) ? Number(bar.open) : null,
                    high: Number.isFinite(Number(bar.high)) ? Number(bar.high) : null,
                    low: Number.isFinite(Number(bar.low)) ? Number(bar.low) : null,
                    close: Number.isFinite(Number(bar.close)) ? Number(bar.close) : null,
                    volume: Number.isFinite(Number(bar.volume)) ? Math.trunc(Number(bar.volume)) : 0,
                    regular_trading_hours: useRTH,
                    adjusted: false,
                    source: 'ibkr'
                };
            })
            .filter((row) => row.timestamp),
        insertRows,
        toEndDateTime: toIbkrEndDateTime,
        logger
    });

    await client.end();
}

main().catch((error) => {
    logger.error('Repair failed:', error);
    process.exit(1);
});
