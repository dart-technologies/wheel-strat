import { isDbConfigured, resolveDbConnection } from '@/lib/cloudsql';

const ORIGINAL_ENV = process.env;

describe('cloudsql config', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.DB_DISABLE;
        delete process.env.DB_HOST;
        delete process.env.DB_SOCKET_PATH;
        delete process.env.CLOUD_SQL_CONNECTION_NAME;
        delete process.env.CLOUDSQL_CONNECTION_NAME;
        delete process.env.DATABASE_URL;
        delete process.env.DB_URL;
        delete process.env.DB_PROVIDER;
        delete process.env.K_SERVICE;
        delete process.env.FUNCTION_TARGET;
        delete process.env.FUNCTION_NAME;
        delete process.env.FUNCTIONS_EMULATOR;
        delete process.env.FIREBASE_EMULATOR_HUB;
        delete process.env.FIREBASE_CONFIG;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('returns null when DB is disabled', () => {
        process.env.DB_DISABLE = 'true';
        process.env.DB_HOST = '127.0.0.1';

        expect(isDbConfigured()).toBe(false);
        expect(resolveDbConnection()).toBeNull();
    });

    it('uses Cloud SQL socket path in cloud runtime', () => {
        process.env.K_SERVICE = 'test-service';

        expect(isDbConfigured()).toBe(true);
        expect(resolveDbConnection()).toEqual({
            socketPath: '/cloudsql/wheel-strat-483102:us-central1:historical'
        });
    });

    it('treats FIREBASE_CONFIG as cloud runtime', () => {
        process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'wheel-strat-483102' });

        expect(isDbConfigured()).toBe(true);
        expect(resolveDbConnection()).toEqual({
            socketPath: '/cloudsql/wheel-strat-483102:us-central1:historical'
        });
    });

    it('prefers explicit socket path', () => {
        process.env.DB_SOCKET_PATH = '/cloudsql/custom';

        expect(resolveDbConnection()).toEqual({ socketPath: '/cloudsql/custom' });
    });

    it('uses host when DB_HOST is set locally', () => {
        process.env.DB_HOST = 'db.internal';

        expect(resolveDbConnection()).toEqual({ host: 'db.internal' });
    });

    it('uses database url when set', () => {
        process.env.DATABASE_URL = 'postgres://user:pass@db.example.com:5432/postgres';

        expect(isDbConfigured()).toBe(true);
        expect(resolveDbConnection()).toEqual({ host: 'db.example.com' });
    });

    it('returns null when not configured in local runtime', () => {
        expect(isDbConfigured()).toBe(false);
        expect(resolveDbConnection()).toBeNull();
    });

    it('correctly builds socket path from project ID if region/instance are default', () => {
        process.env.GCLOUD_PROJECT = 'my-project';
        process.env.K_SERVICE = 'some-function';

        const conn = resolveDbConnection();
        expect(conn).toEqual({
            socketPath: '/cloudsql/my-project:us-central1:historical'
        });
    });

    it('prefers CLOUDSQL_CONNECTION_NAME over GCLOUD_PROJECT', () => {
        process.env.GCLOUD_PROJECT = 'wrong-project';
        process.env.CLOUDSQL_CONNECTION_NAME = 'real-project:us-east1:db';
        process.env.K_SERVICE = 'some-function';

        const conn = resolveDbConnection();
        expect(conn).toEqual({
            socketPath: '/cloudsql/real-project:us-east1:db'
        });
    });
});
