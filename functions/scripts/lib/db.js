const { Client } = require('pg');

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

async function connectDb() {
    const config = resolveDbConnection();
    const client = new Client(config);
    await client.connect();
    return client;
}

async function setForceUpdate(client, enabled) {
    if (!enabled) return;
    await client.query("SELECT set_config('app.force_update', 'true', false)");
}

module.exports = {
    resolveDbConnection,
    connectDb,
    setForceUpdate
};
