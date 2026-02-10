import * as admin from "firebase-admin";
import { fetchWithTimeout } from "./fetch";
import type { PublicMarketConfig } from "./publicMarketDataTypes";

const PUBLIC_TOKEN_TTL_FALLBACK_MS = 24 * 60 * 60 * 1000;
const PUBLIC_TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

type PublicTokenSource = "secret";
type PublicTokenResult = {
    token: string;
    source: PublicTokenSource;
};

type PublicTokenCache = {
    token: string;
    expiresAtMs: number;
};

let cachedAccessToken: PublicTokenCache | null = null;
let inflightTokenPromise: Promise<PublicTokenCache | null> | null = null;
let firestoreTokenPromise: Promise<PublicTokenCache | null> | null = null;

const PUBLIC_TOKEN_COLLECTION = "publicTokens";
const PUBLIC_TOKEN_DOC_ID = "access";

const canUseFirestore = () => admin.apps && admin.apps.length > 0;

async function resolvePublicAccessToken(
    config: PublicMarketConfig,
    timeout: number,
    forceRefresh = false
): Promise<PublicTokenResult | null> {
    if (!config.configured) return null;
    const hasCredentials = Boolean(config.apiKey || config.apiSecret);
    if (!hasCredentials) return null;

    // config.apiKey and config.apiSecret are credentials, not the access token itself.
    // We must exchange them for a bearer token.


    if (!forceRefresh && cachedAccessToken) {
        const remaining = cachedAccessToken.expiresAtMs - Date.now();
        if (remaining > PUBLIC_TOKEN_EXPIRY_BUFFER_MS) {
            return { token: cachedAccessToken.token, source: "secret" };
        }
    }

    const firestoreToken = await getFirestoreAccessToken(config);
    if (firestoreToken) {
        cachedAccessToken = firestoreToken;
        return { token: firestoreToken.token, source: "secret" };
    }

    const fresh = await requestPublicAccessToken(config, timeout);
    if (fresh) cachedAccessToken = fresh;
    return fresh ? { token: fresh.token, source: "secret" } : null;
}

async function getFirestoreAccessToken(config: PublicMarketConfig) {
    if (!config.accountId) return null;
    if (!canUseFirestore()) return null;
    if (!firestoreTokenPromise) {
        firestoreTokenPromise = admin.firestore()
            .collection(PUBLIC_TOKEN_COLLECTION)
            .doc(PUBLIC_TOKEN_DOC_ID)
            .get()
            .then((snapshot) => {
                const data = snapshot.data();
                const token = data?.token ? String(data.token) : "";
                const expiresAtMs = data?.expiresAtMs ? Number(data.expiresAtMs) : 0;
                if (!token || !Number.isFinite(expiresAtMs)) return null;
                if (expiresAtMs - Date.now() <= PUBLIC_TOKEN_EXPIRY_BUFFER_MS) return null;
                return { token, expiresAtMs } as PublicTokenCache;
            })
            .catch(() => null)
            .finally(() => {
                firestoreTokenPromise = null;
            });
    }
    return firestoreTokenPromise;
}

async function requestPublicAccessToken(config: PublicMarketConfig, timeout: number) {
    if (!config.accountId) return null;
    if (!inflightTokenPromise) {
        inflightTokenPromise = (async () => {
            try {
                const startedAt = Date.now();
                console.log("[publicMarketData] requesting access token via credential exchange");
                const payload = {
                    apiKey: config.apiKey || "",
                    apiSecret: config.apiSecret || ""
                };
                const res = await fetchWithTimeout(
                    "https://api.public.com/userapiauthservice/personal/access-tokens",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    },
                    timeout
                );
                const durationMs = Date.now() - startedAt;
                if (durationMs >= 2000) {
                    console.log("[publicMarketData] access token latency", { durationMs });
                }
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    console.warn(`[publicMarketData] Token request failed ${res.status}: ${text}`);
                    return null;
                }
                const data = await res.json();
                const token = data?.accessToken ? String(data.accessToken) : "";
                if (!token) return null;
                let expiresAtMs = Date.now() + PUBLIC_TOKEN_TTL_FALLBACK_MS;
                if (data?.expiresIn) {
                    const expiresInSec = Number(data.expiresIn);
                    if (Number.isFinite(expiresInSec) && expiresInSec > 0) {
                        expiresAtMs = Date.now() + expiresInSec * 1000;
                    }
                }
                const cache = { token, expiresAtMs };
                if (canUseFirestore()) {
                    await admin.firestore()
                        .collection(PUBLIC_TOKEN_COLLECTION)
                        .doc(PUBLIC_TOKEN_DOC_ID)
                        .set(cache, { merge: true });
                }
                return cache;
            } catch (error) {
                console.warn("[publicMarketData] Token request failed:", error);
                return null;
            } finally {
                inflightTokenPromise = null;
            }
        })();
    }
    return inflightTokenPromise;
}

export async function publicRequest(
    config: PublicMarketConfig,
    path: string,
    options: { method?: string; body?: any } = {},
    timeout = 20000
) {
    if (!config.configured) return null;
    const tokenResult = await resolvePublicAccessToken(config, timeout);
    if (!tokenResult?.token) return null;
    const url = `${config.gateway.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenResult.token}`,
        "x-api-key": tokenResult.token
    };
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const res = await fetchWithTimeout(url, {
        method: options.method || "GET",
        headers,
        body
    }, timeout);
    if (res.status === 401 && tokenResult.source === "secret") {
        const refreshed = await resolvePublicAccessToken(config, timeout, true);
        if (refreshed?.token && refreshed.token !== tokenResult.token) {
            const retryRes = await fetchWithTimeout(url, {
                method: options.method || "GET",
                headers: {
                    ...headers,
                    Authorization: `Bearer ${refreshed.token}`,
                    "x-api-key": refreshed.token
                },
                body
            }, timeout);
            if (!retryRes.ok) {
                const text = await retryRes.text().catch(() => "");
                console.warn(`[publicMarketData] Request failed ${retryRes.status} for ${path}: ${text}`);
                return null;
            }
            return retryRes.json();
        }
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[publicMarketData] Request failed ${res.status} for ${path}: ${text}`);
        return null;
    }
    return res.json();
}

export function __resetPublicTokenCache() {
    cachedAccessToken = null;
    inflightTokenPromise = null;
    firestoreTokenPromise = null;
}
