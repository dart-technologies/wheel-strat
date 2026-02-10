#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs, parseBoolean, normalizeSymbols } = require('./lib/args');
const { createLogger } = require('./lib/logger');
const { ingestPolygonSplits, ingestDetectedSplits } = require('./lib/splitIngest');

const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const logger = createLogger('split-sync');

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbols = normalizeSymbols(args.symbols) || DEFAULT_SYMBOLS;

    const skipPolygon = parseBoolean(args['skip-polygon'], false);
    const includeDetected = parseBoolean(args['include-detected'], false);

    if (!skipPolygon) {
        await ingestPolygonSplits({
            symbols,
            sleepMs: args['sleep-ms'],
            dryRun: Boolean(args['dry-run']),
            logger
        });
    }

    if (includeDetected) {
        await ingestDetectedSplits({ symbols, logger });
    } else {
        logger.info('Detected split ingest skipped (pass --include-detected to enable).');
    }
}

main().catch((error) => {
    logger.error('Split sync failed:', error);
    process.exit(1);
});
