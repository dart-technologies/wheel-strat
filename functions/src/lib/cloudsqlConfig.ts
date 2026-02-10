import { isFunctionsEmulator } from "./runtime";

const DEFAULT_CLOUDSQL_PROJECT = "wheel-strat-483102";
const DEFAULT_CLOUDSQL_REGION = "us-central1";
const DEFAULT_CLOUDSQL_INSTANCE = "historical";

export function isCloudRuntime(): boolean {
    return Boolean(
        process.env.K_SERVICE ||
        process.env.FUNCTION_TARGET ||
        process.env.FUNCTION_NAME ||
        process.env.X_GOOGLE_FUNCTION_NAME ||
        process.env.FIREBASE_CONFIG ||
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT
    );
}

export function resolveCloudSqlConnectionName(): string {
    const explicit = process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME;
    if (explicit) return explicit;

    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_CLOUDSQL_PROJECT;
    return `${projectId}:${DEFAULT_CLOUDSQL_REGION}:${DEFAULT_CLOUDSQL_INSTANCE}`;
}

export function isDbConfigured(): boolean {
    if (process.env.DB_DISABLE === "true") {
        return false;
    }
    if (process.env.DATABASE_URL || process.env.DB_URL) {
        return true;
    }
    if (process.env.DB_HOST || process.env.DB_SOCKET_PATH || process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME) {
        return true;
    }
    return isCloudRuntime() && !isFunctionsEmulator();
}

export function resolveDbConnection(): { socketPath?: string; host?: string } | null {
    if (!isDbConfigured()) {
        return null;
    }
    const provider = (process.env.DB_PROVIDER || "").trim().toLowerCase();
    const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;
    if (databaseUrl) {
        try {
            const parsed = new URL(databaseUrl);
            return { host: parsed.hostname };
        } catch {
            return null;
        }
    }
    if (process.env.DB_SOCKET_PATH) {
        return { socketPath: process.env.DB_SOCKET_PATH };
    }
    if (process.env.DB_HOST) {
        const host = process.env.DB_HOST;
        if (isCloudRuntime()) {
            const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(host);
            const forceTcp = String(process.env.DB_FORCE_TCP || "").trim().toLowerCase() === "true";
            if (forceTcp) {
                return { host };
            }
            if (provider === "cloudsql" || isLocalHost) {
                console.warn("[cloudsql] Ignoring DB_HOST in cloud runtime to use Cloud SQL socket.");
            } else {
                return { host };
            }
        } else {
            return { host };
        }
    }
    // Check for explicit Cloud SQL connection name in env to confirm intent
    const hasExplicitConnectionName = !!(process.env.CLOUD_SQL_CONNECTION_NAME || process.env.CLOUDSQL_CONNECTION_NAME);

    // Check for Gen 1 or Gen 2 Cloud Functions environment
    const isCloudEnv = isCloudRuntime();
    const hasFirebaseConfig = Boolean(process.env.FIREBASE_CONFIG);

    if ((isCloudEnv || hasExplicitConnectionName) && !isFunctionsEmulator()) {
        const connectionName = resolveCloudSqlConnectionName();
        const socketPath = `/cloudsql/${connectionName}`;
        console.log(`[cloudsql] Using socket path: ${socketPath}`);
        return { socketPath };
    }

    // If we are strictly local (not emulator, not cloud), fallback to localhost
    if (hasFirebaseConfig && !isFunctionsEmulator()) {
        console.warn("FIREBASE_CONFIG detected but Cloud SQL socket not configured. Falling back to 127.0.0.1.");
    } else if (isCloudEnv) {
        console.warn("Detected Cloud Runtime but failed to configure socket path. Defaulting to 127.0.0.1.");
    }

    return { host: "127.0.0.1" };
}

export function parseSslEnabled(provider?: string): boolean {
    const raw = String(process.env.DB_SSL || "").toLowerCase();
    if (raw) {
        return ["true", "1", "require"].includes(raw);
    }
    return provider === "supabase";
}
