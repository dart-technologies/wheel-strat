const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../lib/env');
loadEnv({ cwd: path.resolve(__dirname, '../..') });
const knex = require('../../functions/node_modules/knex');

const DB_NAME = process.env.DB_NAME || 'wheel_strat_db';
const DATA_PATH = path.resolve(__dirname, '../../assets/data/mag7_historical_1y.json');

const config = {
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        port: 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || 'postgres'),
        database: DB_NAME,
    },
    pool: { min: 0, max: 1 }
};

const db = knex(config);

async function seedDB() {
    try {
        console.log(`Reading data from ${DATA_PATH}...`);
        const rawData = fs.readFileSync(DATA_PATH, 'utf8');
        const jsonData = JSON.parse(rawData);

        console.log(`Connecting to '${DB_NAME}'...`);

        // Prepare batches
        const allBars = [];

        for (const [symbol, data] of Object.entries(jsonData)) {
            if (!data.bars || !Array.isArray(data.bars)) continue;

            console.log(`Processing ${symbol} (${data.bars.length} bars)...`);

            for (const bar of data.bars) {
                // Skip summary/metric objects inside bars array (if any, though refresh script output seemed clean)
                // The refresh script output has bars array of clean objects.
                // Wait, mag7_historical_1y format:
                /*
                  "bars": [
                    { "date": "...", ... },
                    ...
                  ]
                */
                if (!bar.date) continue;

                allBars.push({
                    symbol: symbol,
                    date: bar.date,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }

        console.log(`Prepared ${allBars.length} rows for insertion.`);

        // Use batch insert with conflict handling
        const chunkSize = 500;
        for (let i = 0; i < allBars.length; i += chunkSize) {
            const chunk = allBars.slice(i, i + chunkSize);
            await db('historical_prices')
                .insert(chunk)
                .onConflict(['symbol', 'date'])
                .merge(); // Update if exists
            console.log(`Inserted/Updated rows ${i + 1} to ${Math.min(i + chunkSize, allBars.length)}`);
        }

        console.log('✅ Seeding complete!');

    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await db.destroy();
    }
}

seedDB();
