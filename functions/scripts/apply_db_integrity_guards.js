#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { connectDb } = require('./lib/db');
const { createLogger } = require('./lib/logger');

const logger = createLogger('db-guards');

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const client = await connectDb();

    const guardFunction = `
        CREATE OR REPLACE FUNCTION guard_no_update()
        RETURNS trigger AS $$
        BEGIN
            IF COALESCE(current_setting('app.force_update', true), 'false')::boolean THEN
                RETURN NEW;
            END IF;
            RAISE EXCEPTION 'Updates blocked on %. Set app.force_update=true to allow updates.', TG_TABLE_NAME
                USING ERRCODE = '45000';
        END;
        $$ LANGUAGE plpgsql;
    `;
    const guardDeleteFunction = `
        CREATE OR REPLACE FUNCTION guard_no_delete()
        RETURNS trigger AS $$
        BEGIN
            IF COALESCE(current_setting('app.force_update', true), 'false')::boolean THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'Deletes blocked on %. Set app.force_update=true to allow deletes.', TG_TABLE_NAME
                USING ERRCODE = '45000';
        END;
        $$ LANGUAGE plpgsql;
    `;

    const guardHistorical = `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name = 'historical_prices'
            ) THEN
                DROP TRIGGER IF EXISTS guard_no_update_historical_prices ON historical_prices;
                CREATE TRIGGER guard_no_update_historical_prices
                    BEFORE UPDATE ON historical_prices
                    FOR EACH ROW
                    EXECUTE FUNCTION guard_no_update();
            END IF;
        END $$;
    `;

    const guardIntraday = `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name = 'intraday_prices'
            ) THEN
                DROP TRIGGER IF EXISTS guard_no_update_intraday_prices ON intraday_prices;
                CREATE TRIGGER guard_no_update_intraday_prices
                    BEFORE UPDATE ON intraday_prices
                    FOR EACH ROW
                    EXECUTE FUNCTION guard_no_update();
            END IF;
        END $$;
    `;

    await client.query(guardFunction);
    await client.query(guardDeleteFunction);
    await client.query(guardHistorical);
    await client.query(guardIntraday);
    const guardHistoricalDelete = `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name = 'historical_prices'
            ) THEN
                DROP TRIGGER IF EXISTS guard_no_delete_historical_prices ON historical_prices;
                CREATE TRIGGER guard_no_delete_historical_prices
                    BEFORE DELETE ON historical_prices
                    FOR EACH ROW
                    EXECUTE FUNCTION guard_no_delete();
            END IF;
        END $$;
    `;
    const guardIntradayDelete = `
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name = 'intraday_prices'
            ) THEN
                DROP TRIGGER IF EXISTS guard_no_delete_intraday_prices ON intraday_prices;
                CREATE TRIGGER guard_no_delete_intraday_prices
                    BEFORE DELETE ON intraday_prices
                    FOR EACH ROW
                    EXECUTE FUNCTION guard_no_delete();
            END IF;
        END $$;
    `;
    await client.query(guardHistoricalDelete);
    await client.query(guardIntradayDelete);
    await client.end();
    logger.info('✅ Data integrity guards applied.');
}

main().catch((error) => {
    logger.error('Failed to apply data integrity guards:', error);
    process.exit(1);
});
