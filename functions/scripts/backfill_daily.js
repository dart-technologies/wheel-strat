#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs, parseBoolean, parseNumber } = require('./lib/args');
const { connectDb, setForceUpdate } = require('./lib/db');
const { buildInsertQuery } = require('./lib/insertPolicy');
const { createLogger } = require('./lib/logger');
const { runChunkedBackfill } = require('./lib/ingestEngine');
const { fetchIbkrHistoricalBars } = require('./lib/ibkrHistorical');

const {
    getBridgeUrl,
    getBridgeApiKey
} = require('../../scripts/lib/ibkrBridgeConfig');

const logger = createLogger('backfill-daily');

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

const IBKR_TIMEOUT_MS = 90000;

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbol = String(args.symbol || 'AMZN').toUpperCase();
    const barSize = args['bar-size'] || '1 day';
    const whatToShow = args['what-to-show'] || 'TRADES';
    const initialChunkDays = parseNumber(args['chunk-days'], 1800);
    const minChunkDays = parseNumber(args['min-chunk-days'], 120);
    const maxChunkDays = parseNumber(args['max-chunk-days'], initialChunkDays);
    const maxYears = parseNumber(args['max-years'], 40);
    const useRTH = parseBoolean(args['use-rth'], true);
    const sleepMs = parseNumber(args['sleep-ms'], 900);
    const dryRun = Boolean(args['dry-run']);
    const untilEmpty = Boolean(args['until-empty']);
    const maxEmpty = parseNumber(args['max-empty'], 2);
    const maxTimeouts = parseNumber(args['max-timeouts'], 3);
    const forceUpsert = parseBoolean(args.force, false) || parseBoolean(args['force-upsert'], false);
    const adjusted = String(whatToShow).toUpperCase() === 'ADJUSTED_LAST';

    const explicitBridgeUrl = args['bridge-url'];
    let bridgeUrl = getBridgeUrl(process.env, explicitBridgeUrl);
    const isValidUrl = bridgeUrl && /^https?:\/\//i.test(bridgeUrl);
    if (!isValidUrl && explicitBridgeUrl) {
        logger.error(`Invalid bridge URL provided: ${bridgeUrl}`);
        process.exit(1);
    }
    if (!isValidUrl) {
        const fallbackEnv = { ...process.env };
        delete fallbackEnv.IBKR_BRIDGE_URL;
        delete fallbackEnv.EXPO_PUBLIC_IBKR_BRIDGE_URL;
        bridgeUrl = getBridgeUrl(fallbackEnv, explicitBridgeUrl);
    }
    const apiKey = getBridgeApiKey(process.env, args['api-key']);
    if (!bridgeUrl || !/^https?:\/\//i.test(bridgeUrl)) {
        logger.error(`Bridge URL not resolved. Got: ${bridgeUrl || 'empty'}`);
        process.exit(1);
    }
    if (!apiKey) {
        logger.error('Missing IBKR bridge API key.');
        process.exit(1);
    }

    const end = args.end ? new Date(args.end) : new Date();
    const start = args.start
        ? new Date(args.start)
        : new Date(end.getTime() - maxYears * 365 * 24 * 60 * 60 * 1000);

    const client = await connectDb();
    await setForceUpdate(client, forceUpsert);
    if (forceUpsert) {
        logger.warn('Force upsert enabled for historical_prices.');
    }

    logger.info(`Backfill daily ${symbol} (${formatYmd(start)} → ${formatYmd(end)}) starting ${initialChunkDays}d chunks.`);
    logger.info(`Bridge: ${bridgeUrl}`);

    const normalizedBridge = bridgeUrl.replace(/\/+$/, '');
    const insertRows = async (rows) => {
        const { query, values } = buildInsertQuery({
            table: 'historical_prices',
            columns: ['symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'adjusted', 'source'],
            rows,
            conflictColumns: ['symbol', 'date'],
            updateColumns: ['open', 'high', 'low', 'close', 'volume', 'adjusted', 'source'],
            allowUpdate: forceUpsert
        });
        await client.query(query, values);
    };

    await runChunkedBackfill({
        symbol,
        barSize,
        whatToShow,
        useRTH,
        start,
        end,
        initialChunkDays,
        minChunkDays,
        maxChunkDays,
        untilEmpty,
        maxEmpty,
        maxTimeouts,
        sleepMs,
        dryRun,
        fetchBars: async (payload) => {
            return fetchIbkrHistoricalBars(normalizedBridge, apiKey, payload, IBKR_TIMEOUT_MS);
        },
        mapBars: (bars) => bars
            .map((bar) => {
                return {
                    symbol,
                    date: bar.date,
                    open: Number.isFinite(Number(bar.open)) ? Number(bar.open) : null,
                    high: Number.isFinite(Number(bar.high)) ? Number(bar.high) : null,
                    low: Number.isFinite(Number(bar.low)) ? Number(bar.low) : null,
                    close: Number.isFinite(Number(bar.close)) ? Number(bar.close) : null,
                    volume: Number.isFinite(Number(bar.volume)) ? Math.trunc(Number(bar.volume)) : 0,
                    adjusted,
                    source: 'ibkr'
                };
            })
            .filter((row) => row.date),
        insertRows,
        formatYmd,
        toEndDateTime: toIbkrEndDateTime,
        formatDuration: (days) => (days >= 365 ? `${Math.ceil(days / 365)} Y` : `${days} D`),
        growthStepDays: 180,
        logger
    });

    await client.end();
    logger.info('Backfill complete.');
}

main().catch((error) => {
    logger.error('Backfill failed:', error);
    process.exit(1);
});
