#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs } = require('./lib/args');
const { connectDb, setForceUpdate } = require('./lib/db');
const { createLogger } = require('./lib/logger');

const logger = createLogger('split-remove');

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbol = String(args.symbol || '').trim().toUpperCase();
    if (!symbol) {
        logger.error('Provide --symbol (e.g. --symbol META).');
        process.exit(1);
    }

    const client = await connectDb();
    await setForceUpdate(client, true);
    logger.warn('Force update enabled for split_factors deletion.');
    const result = await client.query('DELETE FROM split_factors WHERE symbol = $1', [symbol]);
    await client.end();
    logger.info(`Deleted ${result.rowCount || 0} split_factors rows for ${symbol}.`);
}

main().catch((error) => {
    logger.error('Failed to remove split factors:', error);
    process.exit(1);
});
