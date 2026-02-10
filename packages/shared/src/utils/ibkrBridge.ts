export type BridgeErrorCode =
    | 'permission-denied'
    | 'not-found'
    | 'unavailable'
    | 'failed-precondition'
    | 'internal';

export interface BridgeFetchResponse {
    ok: boolean;
    status: number;
    json: <T = any>() => Promise<T>;
    text: () => Promise<string>;
}

const DEFAULT_BRIDGE_TIMEOUT_MS = 15000;

export function normalizeBridgeUrl(url: string) {
    return url.replace(/\/+$/, '');
}

export function buildBridgeUrl(baseUrl: string, path: string) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalizedBase = normalizeBridgeUrl(baseUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
}

export function mapBridgeStatusToErrorCode(status: number): BridgeErrorCode {
    if (status === 401 || status === 403) return 'permission-denied';
    if (status === 404) return 'not-found';
    if (status >= 500) return 'unavailable';
    if (status >= 400) return 'failed-precondition';
    return 'internal';
}

export async function fetchBridgeWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_BRIDGE_TIMEOUT_MS,
    bridgeApiKey?: string
): Promise<BridgeFetchResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const rawHeaders = options.headers as Record<string, string> | undefined;
    const headers: Record<string, string> = {
        // Bypass ngrok warning pages for the bridge.
        'ngrok-skip-browser-warning': '1',
        ...(rawHeaders || {}),
        ...(bridgeApiKey ? { 'X-API-KEY': bridgeApiKey } : {}),
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
        });
        return {
            ok: response.ok,
            status: response.status,
            json: <T>() => response.json() as Promise<T>,
            text: () => response.text(),
        };
    } finally {
        clearTimeout(timeoutId);
    }
}
