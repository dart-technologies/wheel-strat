#!/usr/bin/env node
const path = require('path');
const { loadEnv } = require('../lib/env');
const { parseArgs } = require('../lib/cli');
const { Client } = require('pg');

function parseNumber(value, fallback) {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveDbConnection() {
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    if (databaseUrl) return { connectionString: databaseUrl };
    return {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'wheel_strat_db'
    };
}

function startOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, months) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatPartitionName(prefix, date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${prefix}_${year}_${month}`;
}

function formatDate(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        '01'
    ].join('-');
}

async function main() {
    const repoRoot = path.resolve(__dirname, '../..');
    const loaded = loadEnv({
        cwd: repoRoot,
        files: [
            '.env',
            '.env.local',
            'functions/.env',
            'functions/.env.local'
        ]
    });
    if (loaded.length) {
        console.log(`Loaded env from ${loaded.join(', ')}`);
    }
    const args = parseArgs(process.argv.slice(2));
    const monthsAhead = parseNumber(args['months-ahead'], 3);
    const dropOld = Boolean(args['drop-old']);

    const client = new Client(resolveDbConnection());
    await client.connect();

    const existing = await client.query(
        "select to_regclass('public.intraday_prices_part') as exists"
    );
    if (existing.rows[0]?.exists) {
        console.error('intraday_prices_part already exists. Aborting.');
        await client.end();
        process.exit(1);
    }

    const rangeRes = await client.query(
        'select min(timestamp) as min_ts, max(timestamp) as max_ts, count(*)::int as count from intraday_prices'
    );
    const row = rangeRes.rows[0] || {};
    if (!row.count || !row.min_ts || !row.max_ts) {
        console.error('No intraday data found. Aborting.');
        await client.end();
        process.exit(1);
    }

    const minTs = new Date(row.min_ts);
    const maxTs = new Date(row.max_ts);
    const start = startOfMonth(minTs);
    const end = addMonths(startOfMonth(maxTs), monthsAhead + 1);

    console.log(`Partitioning intraday_prices from ${start.toISOString()} to ${end.toISOString()}...`);

    await client.query(`
        create table intraday_prices_part (
            id bigserial,
            symbol text not null,
            timestamp timestamptz not null,
            bar_size text not null default '1 min',
            open numeric(18,6),
            high numeric(18,6),
            low numeric(18,6),
            close numeric(18,6),
            volume bigint,
            regular_trading_hours boolean not null default true,
            adjusted boolean not null default false,
            source text not null default 'ibkr',
            created_at timestamptz default now(),
            updated_at timestamptz default now()
        ) partition by range (timestamp);
    `);

    let cursor = new Date(start);
    while (cursor < end) {
        const next = addMonths(cursor, 1);
        const name = formatPartitionName('intraday_prices_part', cursor);
        const fromDate = formatDate(cursor);
        const toDate = formatDate(next);
        await client.query(`
            create table ${name}
            partition of intraday_prices_part
            for values from ('${fromDate} 00:00:00+00') to ('${toDate} 00:00:00+00');
        `);
        cursor = next;
    }

    await client.query(`
        create table intraday_prices_part_default
        partition of intraday_prices_part default;
    `);

    console.log('Copying data into partitioned table...');
    await client.query(`
        insert into intraday_prices_part (
            id,
            symbol,
            timestamp,
            bar_size,
            open,
            high,
            low,
            close,
            volume,
            regular_trading_hours,
            adjusted,
            source,
            created_at,
            updated_at
        )
        select
            id,
            symbol,
            timestamp,
            bar_size,
            open,
            high,
            low,
            close,
            volume,
            regular_trading_hours,
            adjusted,
            source,
            created_at,
            updated_at
        from intraday_prices;
    `);

    const countOld = await client.query('select count(*)::int as count from intraday_prices');
    const countNew = await client.query('select count(*)::int as count from intraday_prices_part');
    if (Number(countOld.rows[0]?.count || 0) !== Number(countNew.rows[0]?.count || 0)) {
        console.error('Row count mismatch; aborting swap.');
        await client.end();
        process.exit(1);
    }

    await client.query(`
        alter table intraday_prices_part
        add constraint intraday_prices_unique
        unique (symbol, timestamp, bar_size, regular_trading_hours, adjusted);
    `);

    await client.query(`
        create index intraday_prices_symbol_idx on intraday_prices_part (symbol);
    `);
    await client.query(`
        create index intraday_prices_timestamp_brin on intraday_prices_part using brin (timestamp);
    `);
    await client.query(`
        create index intraday_prices_symbol_ts_common_idx
        on intraday_prices_part (symbol, timestamp)
        where bar_size = '1 min' and regular_trading_hours = true and adjusted = false;
    `);

    await client.query(`alter table intraday_prices rename to intraday_prices_old;`);
    await client.query(`alter table intraday_prices_part rename to intraday_prices;`);

    const seqRes = await client.query(
        "select to_regclass('public.intraday_prices_id_seq') as exists"
    );
    if (seqRes.rows[0]?.exists) {
        await client.query(`alter table intraday_prices_old alter column id drop default;`);
        await client.query(`alter table intraday_prices alter column id set default nextval('intraday_prices_id_seq');`);
        await client.query(`alter sequence intraday_prices_id_seq owned by intraday_prices.id;`);
        await client.query(`select setval('intraday_prices_id_seq', (select max(id) from intraday_prices));`);
        await client.query(`drop sequence if exists intraday_prices_part_id_seq;`);
    } else {
        await client.query(`alter sequence intraday_prices_part_id_seq rename to intraday_prices_id_seq;`);
        await client.query(`alter table intraday_prices alter column id set default nextval('intraday_prices_id_seq');`);
        await client.query(`select setval('intraday_prices_id_seq', (select max(id) from intraday_prices));`);
        await client.query(`alter sequence intraday_prices_id_seq owned by intraday_prices.id;`);
    }

    if (dropOld) {
        await client.query(`drop table intraday_prices_old;`);
        console.log('Dropped intraday_prices_old.');
    } else {
        console.log('Kept intraday_prices_old for rollback. Drop manually when ready.');
    }

    await client.end();
    console.log('Partitioning complete.');
}

main().catch((error) => {
    console.error('Partitioning failed:', error);
    process.exit(1);
});
