#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnv } = require('./lib/env');
const { createLogger } = require('./lib/logger');

const FALLBACK_FILENAME = 'mag7_historical_1y.json';
const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const logger = createLogger('db-check');

function isEmulator() {
    return process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_EMULATOR_HUB);
}

function isCloudRuntime() {
    return Boolean(
        process.env.K_SERVICE ||
        process.env.FUNCTION_TARGET ||
        process.env.FUNCTION_NAME ||
        process.env.X_GOOGLE_FUNCTION_NAME ||
        process.env.FIREBASE_CONFIG
    );
}

function resolveCloudSqlConnectionName() {
    const explicit = process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME;
    if (explicit) return explicit;

    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'wheel-strat-483102';
    const region = process.env.CLOUD_SQL_REGION || 'us-central1';
    const instance = process.env.CLOUD_SQL_INSTANCE || 'historical';
    return `${projectId}:${region}:${instance}`;
}

function isDbConfigured() {
    if (process.env.DB_DISABLE === 'true') return false;
    if (process.env.DATABASE_URL || process.env.DB_URL) return true;
    if (process.env.DB_HOST || process.env.DB_SOCKET_PATH || process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME) {
        return true;
    }
    return isCloudRuntime() && !isEmulator();
}

function resolveDbConnection() {
    if (!isDbConfigured()) return null;
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    if (databaseUrl) {
        try {
            const parsed = new URL(databaseUrl);
            return { host: parsed.hostname };
        } catch {
            return null;
        }
    }

    if (process.env.DB_SOCKET_PATH) return { socketPath: process.env.DB_SOCKET_PATH };
    if (process.env.DB_HOST) return { host: process.env.DB_HOST };

    const hasExplicitConnectionName = !!(process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME);
    const isCloudEnv = isCloudRuntime();
    const hasFirebaseConfig = Boolean(process.env.FIREBASE_CONFIG);

    if ((isCloudEnv || hasExplicitConnectionName) && !isEmulator()) {
        const connectionName = resolveCloudSqlConnectionName();
        return { socketPath: `/cloudsql/${connectionName}` };
    }

    if (hasFirebaseConfig && !isEmulator()) {
        console.warn('FIREBASE_CONFIG detected but Cloud SQL socket not configured. Falling back to 127.0.0.1.');
    } else if (isCloudEnv) {
        console.warn('Detected Cloud Runtime but failed to configure socket path. Defaulting to 127.0.0.1.');
    }

    return { host: '127.0.0.1' };
}

function parseSslEnabled(provider) {
    const raw = String(process.env.DB_SSL || '').toLowerCase();
    if (raw) {
        return ['true', '1', 'require'].includes(raw);
    }
    return provider === 'supabase';
}

function resolveFallbackPath() {
    const candidates = [];
    if (process.env.HISTORICAL_FALLBACK_PATH) {
        candidates.push(process.env.HISTORICAL_FALLBACK_PATH);
    }
    candidates.push(path.resolve(__dirname, `../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(__dirname, `../../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `../../assets/data/${FALLBACK_FILENAME}`));
    candidates.push(path.resolve(process.cwd(), `functions/assets/data/${FALLBACK_FILENAME}`));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    return null;
}

function parseSymbols(args) {
    if (!args.length) return DEFAULT_SYMBOLS;
    const raw = args.join(',');
    return raw.split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
}

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));

    const symbols = parseSymbols(process.argv.slice(2));
    const provider = (process.env.DB_PROVIDER || '').trim().toLowerCase();
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    logger.info('--- Database Connectivity Check ---');
    logger.info('Symbols:', symbols.join(', ') || '(none)');
    if (provider) {
        logger.info(`DB provider: ${provider}`);
    }

    const fallbackPath = resolveFallbackPath();
    if (fallbackPath) {
        logger.info(`Fallback JSON: ${fallbackPath}`);
    } else {
        logger.warn('Fallback JSON: not found');
    }

    let fallbackData = null;
    if (fallbackPath) {
        try {
            fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
        } catch (error) {
            logger.warn('Failed to read fallback JSON:', error);
        }
    }

    const dbConfigured = isDbConfigured();
    logger.info(`DB configured: ${dbConfigured ? 'yes' : 'no'}`);

    const countsBySymbol = {};
    let dbReachable = false;

    if (dbConfigured) {
        const connection = resolveDbConnection();
        if (!connection) {
            logger.warn('DB connection could not be resolved.');
        } else {
            const sslEnabled = parseSslEnabled(provider);
            const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false';
            const sslConfig = sslEnabled ? { ssl: { rejectUnauthorized } } : {};
            const dbConfig = databaseUrl
                ? {
                    connectionString: databaseUrl,
                    connectionTimeoutMillis: 10000,
                    statement_timeout: 10000,
                    query_timeout: 10000,
                    ...sslConfig
                }
                : {
                    host: connection.socketPath || connection.host,
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'postgres',
                    database: process.env.DB_NAME || 'wheel_strat_db',
                    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
                    connectionTimeoutMillis: 10000,
                    statement_timeout: 10000,
                    query_timeout: 10000,
                    ...sslConfig
                };

            if (databaseUrl) {
                try {
                    const parsed = new URL(databaseUrl);
                    logger.info('DB host:', parsed.hostname);
                    logger.info('DB name:', parsed.pathname.replace('/', '') || '(from url)');
                    logger.info('DB user:', parsed.username || '(from url)');
                } catch {
                    logger.info('DB host: (from url)');
                    logger.info('DB name: (from url)');
                    logger.info('DB user: (from url)');
                }
            } else {
                logger.info('DB host:', dbConfig.host);
                logger.info('DB name:', dbConfig.database);
                logger.info('DB user:', dbConfig.user);
            }

            const client = new Client(dbConfig);
            try {
                await client.connect();
                dbReachable = true;
                const result = await client.query(
                    'select symbol, count(*)::int as count from historical_prices where symbol = any($1) group by symbol',
                    [symbols]
                );
                result.rows.forEach((row) => {
                    if (row.symbol) countsBySymbol[String(row.symbol).toUpperCase()] = Number(row.count || 0);
                });
                const guardResult = await client.query(
                    `select event_object_table as table_name, trigger_name
                       from information_schema.triggers
                      where trigger_name in (
                        'guard_no_update_historical_prices',
                        'guard_no_delete_historical_prices',
                        'guard_no_update_intraday_prices',
                        'guard_no_delete_intraday_prices'
                      )`
                );
                const guards = guardResult.rows || [];
                const guardNames = new Set(guards.map((row) => row.trigger_name));
                const expectedGuards = [
                    'guard_no_update_historical_prices',
                    'guard_no_delete_historical_prices',
                    'guard_no_update_intraday_prices',
                    'guard_no_delete_intraday_prices'
                ];
                const missingGuards = expectedGuards.filter((name) => !guardNames.has(name));
                if (missingGuards.length) {
                    logger.warn(`Missing integrity guards: ${missingGuards.join(', ')}`);
                } else {
                    logger.info('Integrity guards: OK');
                }
                logger.info('DB connection: OK');
            } catch (error) {
                logger.error('DB connection: FAILED', error);
            } finally {
                try {
                    await client.end();
                } catch {
                    // ignore close errors
                }
            }
        }
    }

    logger.info('--- Historical Data Sources ---');
    symbols.forEach((symbol) => {
        const dbCount = countsBySymbol[symbol] || 0;
        const fallbackBars = fallbackData?.[symbol]?.bars;
        const hasFallback = Array.isArray(fallbackBars) && fallbackBars.length > 0;
        const wouldUseFallback = (!dbReachable || dbCount === 0) && hasFallback;
        const status = dbReachable
            ? (dbCount > 0 ? 'db' : (hasFallback ? 'fallback' : 'missing'))
            : (hasFallback ? 'fallback' : 'missing');

        logger.info(`${symbol}: dbRows=${dbCount} fallback=${hasFallback ? 'yes' : 'no'} -> ${status}${wouldUseFallback ? ' (fallback)' : ''}`);
    });

    if (!dbReachable && dbConfigured) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    logger.error('Unexpected error:', error);
    process.exit(1);
});
