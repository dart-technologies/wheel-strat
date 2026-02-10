import { Knex, knex } from "knex";
import { ensureSchema } from "./cloudsqlSchema";
import { isDbConfigured, parseSslEnabled, resolveDbConnection } from "./cloudsqlConfig";

export { isDbConfigured, resolveDbConnection } from "./cloudsqlConfig";

let dbInstance: Knex | null = null;

export const getDB = (): Knex => {
    if (!dbInstance) {
        const provider = (process.env.DB_PROVIDER || "").trim().toLowerCase();
        const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
        const sslEnabled = parseSslEnabled(provider);
        const sslRejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "").toLowerCase() !== "false";
        const sslConfig = sslEnabled ? { ssl: { rejectUnauthorized: sslRejectUnauthorized } } : {};

        if (databaseUrl) {
            const config: Knex.Config = {
                client: "pg",
                connection: sslEnabled
                    ? { connectionString: databaseUrl, ...sslConfig }
                    : databaseUrl,
                pool: { min: 0, max: 1 },
                acquireConnectionTimeout: 10000,
            };
            dbInstance = knex(config);
            return dbInstance;
        }

        const connection = resolveDbConnection();
        if (!connection) {
            throw new Error("Database not configured. Set DB_HOST or Cloud SQL connection settings.");
        }
        const host = connection.socketPath || connection.host;
        const config: Knex.Config = {
            client: "pg",
            connection: {
                host,
                user: process.env.DB_USER || "postgres",
                password: process.env.DB_PASSWORD || "postgres",
                database: process.env.DB_NAME || "wheel_strat_db",
                ...sslConfig
            },
            pool: { min: 0, max: 1 }, // Serverless functions need small pool
            acquireConnectionTimeout: 10000,
        };
        dbInstance = knex(config);
    }
    return dbInstance;
};

export const closeDB = async () => {
    if (dbInstance) {
        await dbInstance.destroy();
        dbInstance = null;
    }
};

export const withForceUpdate = async <T>(handler: (trx: Knex.Transaction) => Promise<T>): Promise<T> => {
    const db = getDB();
    return db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.force_update', 'true', true)");
        return handler(trx);
    });
};

/**
 * Initialize database schema if not exists
 */
export const initSchema = async () => {
    if (!isDbConfigured()) {
        console.warn("Database not configured; skipping schema initialization.");
        return;
    }

    const db = getDB();
    await ensureSchema(db);
};
