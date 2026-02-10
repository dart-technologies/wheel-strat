const path = require('path');
const { loadEnv } = require('../lib/env');
loadEnv({ cwd: path.resolve(__dirname, '../..') });
const knex = require('knex');

const DB_NAME = process.env.DB_NAME || 'wheel_strat_db';

const config = {
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        port: 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres',
    }
};

async function initDB() {
    let db = knex(config);
    try {
        console.log(`Connecting to 'postgres' to create '${DB_NAME}'...`);
        // Check if DB exists
        const res = await db.raw(`SELECT 1 FROM pg_database WHERE datname = ?`, [DB_NAME]);
        if (res.rowCount === 0) {
            console.log(`Creating database ${DB_NAME}...`);
            await db.raw(`CREATE DATABASE "${DB_NAME}"`);
            console.log(`✅ Database ${DB_NAME} created.`);
        } else {
            console.log(`Database ${DB_NAME} already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err.message);
        process.exit(1);
    } finally {
        await db.destroy();
    }

    // Now connect to the new DB to create tables
    console.log('Original config password type:', typeof config.connection.password);
    const pass = config.connection.password || 'postgres';

    const newConfig = {
        client: 'pg',
        connection: {
            host: '127.0.0.1',
            port: 5432,
            user: config.connection.user,
            password: String(pass), // Ensure string
            database: DB_NAME
        }
    };
    db = knex(newConfig);

    try {
        console.log(`Connecting to '${DB_NAME}' to initialize schema...`);

        if (!(await db.schema.hasTable('historical_prices'))) {
            await db.schema.createTable('historical_prices', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.date('date').notNullable().index();
                table.decimal('open', 14, 2);
                table.decimal('high', 14, 2);
                table.decimal('low', 14, 2);
                table.decimal('close', 14, 2);
                table.bigInteger('volume');
                table.boolean('adjusted').notNullable().defaultTo(false).index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'date']);
                table.timestamps(true, true);
            });
            console.log('✅ Created historical_prices table');
        } else {
            console.log('historical_prices table already exists');
            const hasAdjusted = await db.schema.hasColumn('historical_prices', 'adjusted');
            if (!hasAdjusted) {
                await db.schema.alterTable('historical_prices', (table) => {
                    table.boolean('adjusted').notNullable().defaultTo(false).index();
                });
                console.log('✅ Added adjusted to historical_prices');
            }
            const hasSource = await db.schema.hasColumn('historical_prices', 'source');
            if (!hasSource) {
                await db.schema.alterTable('historical_prices', (table) => {
                    table.string('source').notNullable().defaultTo('ibkr').index();
                });
                console.log('✅ Added source to historical_prices');
            }
        }

        if (!(await db.schema.hasTable('technical_indicators'))) {
            await db.schema.createTable('technical_indicators', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.date('date').notNullable().index();
                table.decimal('rsi_14', 10, 4);
                table.decimal('sma_20', 14, 2);
                table.decimal('sma_50', 14, 2);
                table.decimal('sma_200', 14, 2);
                table.unique(['symbol', 'date']);
                table.timestamps(true, true);
            });
            console.log('✅ Created technical_indicators table');
        } else {
            console.log('technical_indicators table already exists');
        }

        if (!(await db.schema.hasTable('options_snapshots'))) {
            await db.schema.createTable('options_snapshots', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.date('date').notNullable().index();
                table.jsonb('chain_data');
                table.timestamps(true, true);
            });
            console.log('✅ Created options_snapshots table');
        } else {
            console.log('options_snapshots table already exists');
        }

        if (!(await db.schema.hasTable('intraday_prices'))) {
            await db.schema.createTable('intraday_prices', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.timestamp('timestamp').notNullable().index();
                table.string('bar_size').notNullable().defaultTo('1 min').index();
                table.decimal('open', 18, 6);
                table.decimal('high', 18, 6);
                table.decimal('low', 18, 6);
                table.decimal('close', 18, 6);
                table.bigInteger('volume');
                table.boolean('regular_trading_hours').notNullable().defaultTo(true).index();
                table.boolean('adjusted').notNullable().defaultTo(false).index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'timestamp', 'bar_size', 'regular_trading_hours', 'adjusted']);
                table.timestamps(true, true);
            });
            console.log('✅ Created intraday_prices table');
        } else {
            console.log('intraday_prices table already exists');
            const hasRth = await db.schema.hasColumn('intraday_prices', 'regular_trading_hours');
            if (!hasRth) {
                await db.schema.alterTable('intraday_prices', (table) => {
                    table.boolean('regular_trading_hours').notNullable().defaultTo(true).index();
                });
                console.log('✅ Added regular_trading_hours to intraday_prices');
            }
            const hasAdjusted = await db.schema.hasColumn('intraday_prices', 'adjusted');
            if (!hasAdjusted) {
                await db.schema.alterTable('intraday_prices', (table) => {
                    table.boolean('adjusted').notNullable().defaultTo(false).index();
                });
                console.log('✅ Added adjusted to intraday_prices');
            }
            const hasSource = await db.schema.hasColumn('intraday_prices', 'source');
            if (!hasSource) {
                await db.schema.alterTable('intraday_prices', (table) => {
                    table.string('source').notNullable().defaultTo('ibkr').index();
                });
                console.log('✅ Added source to intraday_prices');
            }
        }

        if (!(await db.schema.hasTable('volatility_regimes'))) {
            await db.schema.createTable('volatility_regimes', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.date('date').notNullable().index();
                table.decimal('implied_vol', 10, 4);
                table.decimal('realized_vol', 10, 4);
                table.decimal('iv_rank', 10, 4);
                table.decimal('iv_percentile', 10, 4);
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'date', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created volatility_regimes table');
        } else {
            console.log('volatility_regimes table already exists');
        }

        if (!(await db.schema.hasTable('pattern_stats'))) {
            await db.schema.createTable('pattern_stats', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.string('pattern_id').notNullable().index();
                table.string('bar_size').notNullable().index();
                table.decimal('drop_pct', 10, 6);
                table.integer('max_duration_minutes');
                table.integer('rebound_window_minutes');
                table.integer('occurrences');
                table.decimal('avg_drop_pct', 10, 6);
                table.decimal('median_drop_pct', 10, 6);
                table.decimal('worst_drop_pct', 10, 6);
                table.decimal('rebound_rate', 10, 6);
                table.decimal('avg_rebound_pct', 10, 6);
                table.timestamp('sample_start').index();
                table.timestamp('sample_end').index();
                table.boolean('regular_trading_hours').notNullable().defaultTo(true).index();
                table.boolean('adjusted').notNullable().defaultTo(false).index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'pattern_id', 'bar_size', 'regular_trading_hours', 'adjusted', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created pattern_stats table');
        } else {
            console.log('pattern_stats table already exists');
        }

        if (!(await db.schema.hasTable('pattern_stats_vol'))) {
            await db.schema.createTable('pattern_stats_vol', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.string('pattern_id').notNullable().index();
                table.string('bar_size').notNullable().index();
                table.string('vol_bucket').notNullable().index();
                table.string('vol_source').notNullable().defaultTo('realized_20d').index();
                table.integer('vol_window_days').notNullable().defaultTo(20);
                table.decimal('drop_pct', 10, 6);
                table.integer('max_duration_minutes');
                table.integer('rebound_window_minutes');
                table.integer('occurrences');
                table.decimal('avg_drop_pct', 10, 6);
                table.decimal('median_drop_pct', 10, 6);
                table.decimal('worst_drop_pct', 10, 6);
                table.decimal('rebound_rate', 10, 6);
                table.decimal('avg_rebound_pct', 10, 6);
                table.timestamp('sample_start').index();
                table.timestamp('sample_end').index();
                table.boolean('regular_trading_hours').notNullable().defaultTo(true).index();
                table.boolean('adjusted').notNullable().defaultTo(false).index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'pattern_id', 'bar_size', 'vol_bucket', 'regular_trading_hours', 'adjusted', 'vol_source', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created pattern_stats_vol table');
        } else {
            console.log('pattern_stats_vol table already exists');
        }

        if (!(await db.schema.hasTable('split_factors'))) {
            await db.schema.createTable('split_factors', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.date('date').notNullable().index();
                table.decimal('factor', 14, 8).notNullable();
                table.decimal('detected_ratio', 14, 8);
                table.string('source').notNullable().defaultTo('detected').index();
                table.decimal('confidence', 10, 6);
                table.unique(['symbol', 'date']);
                table.timestamps(true, true);
            });
            console.log('✅ Created split_factors table');
        } else {
            console.log('split_factors table already exists');
        }

        if (!(await db.schema.hasTable('strategy_stats'))) {
            await db.schema.createTable('strategy_stats', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.string('strategy_name').notNullable().index();
                table.string('recommended_strategy');
                table.decimal('target_delta', 10, 4);
                table.decimal('win_rate', 10, 6);
                table.integer('total_trades');
                table.decimal('avg_return', 12, 6);
                table.decimal('max_drawdown', 12, 6);
                table.decimal('efficiency_score', 10, 4);
                table.integer('horizon_days');
                table.date('sample_start').index();
                table.date('sample_end').index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'strategy_name', 'horizon_days', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created strategy_stats table');
        } else {
            console.log('strategy_stats table already exists');
        }

        if (!(await db.schema.hasTable('strategy_stats_vol'))) {
            await db.schema.createTable('strategy_stats_vol', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.string('strategy_name').notNullable().index();
                table.string('vol_bucket').notNullable().index();
                table.string('vol_source').notNullable().defaultTo('realized_20d').index();
                table.integer('vol_window_days').notNullable().defaultTo(20);
                table.string('recommended_strategy');
                table.decimal('target_delta', 10, 4);
                table.decimal('win_rate', 10, 6);
                table.integer('total_trades');
                table.decimal('avg_return', 12, 6);
                table.decimal('max_drawdown', 12, 6);
                table.decimal('efficiency_score', 10, 4);
                table.integer('horizon_days');
                table.date('sample_start').index();
                table.date('sample_end').index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'strategy_name', 'horizon_days', 'vol_bucket', 'vol_source', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created strategy_stats_vol table');
        } else {
            console.log('strategy_stats_vol table already exists');
        }

        if (!(await db.schema.hasTable('premium_anomalies'))) {
            await db.schema.createTable('premium_anomalies', (table) => {
                table.increments('id');
                table.string('symbol').notNullable().index();
                table.string('expiration').notNullable().index();
                table.decimal('strike', 14, 4).notNullable().index();
                table.string('right').notNullable().index();
                table.decimal('premium', 14, 6);
                table.string('premium_source');
                table.decimal('model_price', 14, 6);
                table.decimal('theoretical_price', 14, 6);
                table.decimal('premium_ratio', 12, 6).index();
                table.decimal('implied_vol', 10, 6);
                table.decimal('realized_vol', 10, 6);
                table.decimal('iv_rank', 10, 4);
                table.timestamp('observed_at').notNullable().index();
                table.boolean('regular_trading_hours').notNullable().defaultTo(true).index();
                table.boolean('adjusted').notNullable().defaultTo(false).index();
                table.string('source').notNullable().defaultTo('ibkr').index();
                table.unique(['symbol', 'expiration', 'strike', 'right', 'observed_at', 'source']);
                table.timestamps(true, true);
            });
            console.log('✅ Created premium_anomalies table');
        } else {
            console.log('premium_anomalies table already exists');
        }

    } catch (err) {
        console.error('Error initializing schema:', err);
    } finally {
        await db.destroy();
    }
}

initDB();
