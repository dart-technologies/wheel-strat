#!/usr/bin/env node
const { Client } = require('pg');
const { loadEnv } = require('./lib/env');
const { parseArgs } = require('./lib/args');
const { createLogger } = require('./lib/logger');

process.stdout.on('error', (err) => {
    if (err && err.code === 'EPIPE') {
        process.exit(0);
    }
});

const DEFAULT_SYMBOLS = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const logger = createLogger('health');

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

function formatDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    const raw = String(value);
    return raw.split('T')[0];
}

function formatPercent(value, digits = 1) {
    if (value === null || value === undefined) return 'n/a';
    const num = Number(value);
    if (!Number.isFinite(num)) return 'n/a';
    return `${(num * 100).toFixed(digits)}%`;
}

function countWeekdayGaps(datesDesc) {
    let gapCount = 0;
    let maxGap = 0;
    for (let i = 0; i < datesDesc.length - 1; i += 1) {
        const current = new Date(datesDesc[i]);
        const next = new Date(datesDesc[i + 1]);
        const diffDays = Math.round((current.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays <= 1) continue;
        let gap = 0;
        for (let d = 1; d < diffDays; d += 1) {
            const day = new Date(next);
            day.setDate(day.getDate() + d);
            const weekday = day.getDay();
            if (weekday >= 1 && weekday <= 5) {
                gap += 1;
            }
        }
        if (gap > 0) {
            gapCount += gap;
            if (gap > maxGap) maxGap = gap;
        }
    }
    return { gapCount, maxGap };
}

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbolArg = args.symbol || args.symbols;
    const symbols = symbolArg
        ? String(symbolArg)
            .split(',')
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean)
        : (DEFAULT_SYMBOLS.length ? DEFAULT_SYMBOLS : ['AMZN']);

    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    const provider = (process.env.DB_PROVIDER || '').trim().toLowerCase();
    const sslEnabled = parseSslEnabled(provider);
    const sslRejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false';
    const sslConfig = sslEnabled ? { ssl: { rejectUnauthorized: sslRejectUnauthorized } } : {};

    const connection = resolveDbConnection();
    if (!connection && !databaseUrl) {
        console.error('DB not configured. Set DATABASE_URL or DB_HOST.');
        process.exit(1);
    }

    const dbConfig = databaseUrl
        ? databaseUrl
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

    const client = new Client(dbConfig);
    await client.connect();

    console.log('--- Historical Health ---');
    for (const symbol of symbols) {
        const dailyMeta = await client.query(
            'select max(date) as max_date, min(date) as min_date, count(*)::int as count, count(*) filter (where close is null) as null_close from historical_prices where symbol = $1',
            [symbol]
        );
        const dailyRow = dailyMeta.rows[0] || {};
        const lastDate = formatDate(dailyRow.max_date);
        const firstDate = formatDate(dailyRow.min_date);

        const recentDatesRes = await client.query(
            'select date from historical_prices where symbol = $1 order by date desc limit 260',
            [symbol]
        );
        const recentDates = recentDatesRes.rows.map((row) => formatDate(row.date)).filter(Boolean);
        const gapInfo = countWeekdayGaps(recentDates);

        const intradayMeta = await client.query(
            'select max(timestamp) as max_ts, count(*)::int as count from intraday_prices where symbol = $1',
            [symbol]
        );
        const intradayRow = intradayMeta.rows[0] || {};
        const lastIntraday = intradayRow.max_ts instanceof Date ? intradayRow.max_ts : null;
        const intradayAgeMinutes = lastIntraday
            ? Math.round((Date.now() - lastIntraday.getTime()) / (60 * 1000))
            : null;

        console.log(`\n${symbol}`);
        console.log(`  Daily: ${dailyRow.count || 0} bars (${firstDate || 'n/a'} → ${lastDate || 'n/a'})`);
        console.log(`  Daily gaps (last 260): ${gapInfo.gapCount} missing weekdays (max gap ${gapInfo.maxGap}d)`);
        console.log(`  Daily null closes: ${dailyRow.null_close || 0}`);
        if (lastIntraday) {
            console.log(`  Intraday: ${intradayRow.count || 0} bars, last ${lastIntraday.toISOString()} (${intradayAgeMinutes} min ago)`);
        } else {
            console.log('  Intraday: no data');
        }

        const splitRows = await client.query(
            'select date, factor from split_factors where symbol = $1 order by date',
            [symbol]
        );
        if (splitRows.rows.length) {
            const splitList = splitRows.rows.map((row) => `${formatDate(row.date)} x${row.factor}`).join(', ');
            console.log(`  Splits: ${splitRows.rows.length} (${splitList})`);
        } else {
            console.log('  Splits: none');
        }

        const patternRows = await client.query(
            'select pattern_id, bar_size, occurrences, rebound_rate, avg_rebound_pct, created_at from pattern_stats where symbol = $1 order by created_at desc',
            [symbol]
        );
        if (patternRows.rows.length) {
            console.log('  Pattern stats:');
            patternRows.rows.slice(0, 5).forEach((row) => {
                const reboundRate = formatPercent(row.rebound_rate, 0);
                const avgRebound = formatPercent(row.avg_rebound_pct, 1);
                const createdAt = row.created_at ? new Date(row.created_at).toISOString() : 'n/a';
                console.log(`    ${row.pattern_id} (${row.bar_size}) occ=${row.occurrences} rebound=${reboundRate} avg=${avgRebound} @ ${createdAt}`);
            });
        } else {
            console.log('  Pattern stats: none');
        }

        const strategyRows = await client.query(
            'select strategy_name, horizon_days, total_trades, win_rate, avg_return, max_drawdown from strategy_stats where symbol = $1 order by total_trades desc',
            [symbol]
        );
        if (strategyRows.rows.length) {
            console.log('  Strategy stats:');
            strategyRows.rows.slice(0, 5).forEach((row) => {
                const winRate = formatPercent(row.win_rate, 1);
                const avgReturn = formatPercent(row.avg_return, 2);
                const maxDD = formatPercent(row.max_drawdown, 2);
                console.log(`    ${row.strategy_name} (${row.horizon_days}d) trades=${row.total_trades} win=${winRate} avg=${avgReturn} maxDD=${maxDD}`);
            });
        } else {
            console.log('  Strategy stats: none');
        }

        const patternVolMeta = await client.query(
            'select count(*)::int as count from pattern_stats_vol where symbol = $1',
            [symbol]
        );
        const patternVolCount = patternVolMeta.rows[0]?.count || 0;
        console.log(`  Pattern stats (vol buckets): ${patternVolCount}`);

        const strategyVolMeta = await client.query(
            'select count(*)::int as count from strategy_stats_vol where symbol = $1',
            [symbol]
        );
        const strategyVolCount = strategyVolMeta.rows[0]?.count || 0;
        console.log(`  Strategy stats (vol buckets): ${strategyVolCount}`);

        const volMeta = await client.query(
            'select count(*)::int as count, min(date) as min_date, max(date) as max_date from volatility_regimes where symbol = $1',
            [symbol]
        );
        const volRow = volMeta.rows[0] || {};
        if (volRow.count > 0) {
            const latestVol = await client.query(
                'select date, implied_vol, realized_vol, iv_rank from volatility_regimes where symbol = $1 order by date desc limit 1',
                [symbol]
            );
            const latest = latestVol.rows[0] || {};
            console.log(`  Vol regimes: ${volRow.count} rows (${formatDate(volRow.min_date)} → ${formatDate(volRow.max_date)})`);
            console.log(`    Latest: ${formatDate(latest.date)} IV=${formatPercent(latest.implied_vol, 1)} RV=${formatPercent(latest.realized_vol, 1)} IV Rank=${latest.iv_rank !== null && latest.iv_rank !== undefined ? `${Number(latest.iv_rank).toFixed(0)}` : 'n/a'}`);
        } else {
            console.log('  Vol regimes: none');
        }

        const premiumMeta = await client.query(
            'select count(*)::int as count, min(observed_at) as min_obs, max(observed_at) as max_obs, max(premium_ratio) as max_ratio from premium_anomalies where symbol = $1',
            [symbol]
        );
        const premiumRow = premiumMeta.rows[0] || {};
        if (premiumRow.count > 0) {
            console.log(`  Premium anomalies: ${premiumRow.count} rows (${formatDate(premiumRow.min_obs)} → ${formatDate(premiumRow.max_obs)}) maxRatio=${premiumRow.max_ratio ? Number(premiumRow.max_ratio).toFixed(2) : 'n/a'}`);
        } else {
            console.log('  Premium anomalies: none');
        }
    }

    await client.end();
}

main().catch((error) => {
    console.error('Historical health check failed:', error);
    process.exit(1);
});
