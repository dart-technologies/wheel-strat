#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const { parseArgs, normalizeSymbols } = require('./lib/args');
const { createLogger } = require('./lib/logger');

const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const logger = createLogger('precompute');

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbols = normalizeSymbols(args.symbols) || DEFAULT_SYMBOLS;

    const modulePath = path.resolve(__dirname, '../lib/functions/src/analysis/backtestPipeline.js');
    if (!fs.existsSync(modulePath)) {
        logger.error('Missing compiled functions. Run: yarn --cwd functions build');
        process.exit(1);
    }

    const pipeline = require(modulePath);
    const {
        backfillVolatilityRegimesInternal,
        precomputePatternStatsInternal,
        precomputeStrategyStatsInternal
    } = pipeline;

    if (typeof backfillVolatilityRegimesInternal !== 'function') {
        logger.error('backfillVolatilityRegimesInternal export missing from compiled module.');
        process.exit(1);
    }
    if (typeof precomputePatternStatsInternal !== 'function') {
        logger.error('precomputePatternStatsInternal export missing from compiled module.');
        process.exit(1);
    }
    if (typeof precomputeStrategyStatsInternal !== 'function') {
        logger.error('precomputeStrategyStatsInternal export missing from compiled module.');
        process.exit(1);
    }

    const skipVol = Boolean(args['skip-vol']);
    const skipPatterns = Boolean(args['skip-patterns']);
    const skipStrategy = Boolean(args['skip-strategy']);

    if (!skipVol) {
        logger.info(`Backfilling volatility regimes for: ${symbols.join(', ')}`);
        await backfillVolatilityRegimesInternal(symbols);
    }

    if (!skipPatterns) {
        logger.info(`Precomputing pattern stats for: ${symbols.join(', ')}`);
        await precomputePatternStatsInternal(symbols);
    }

    if (!skipStrategy) {
        logger.info(`Precomputing strategy stats for: ${symbols.join(', ')}`);
        await precomputeStrategyStatsInternal(symbols);
    }
}

main().catch((error) => {
    logger.error('Precompute run failed:', error);
    process.exit(1);
});
