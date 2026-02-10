#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs, normalizeSymbols } = require('./lib/args');
const { createLogger } = require('./lib/logger');
const { ingestPolygonSplits } = require('./lib/splitIngest');

const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const logger = createLogger('split-polygon');

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbols = normalizeSymbols(args.symbols) || DEFAULT_SYMBOLS;

    await ingestPolygonSplits({
        symbols,
        sleepMs: args['sleep-ms'],
        dryRun: Boolean(args['dry-run']),
        logger
    });
}

main().catch((error) => {
    logger.error('Split factor ingest failed:', error);
    process.exit(1);
});
