import { EnvRecord, readBoolEnv, readEnv } from './env';

export type IbkrTradingMode = 'paper' | 'live';
export type IbkrBridgeProfile = 'local_mac' | 'local_docker' | 'remote_docker';

const DEFAULT_BRIDGE_PROFILE: IbkrBridgeProfile = 'remote_docker';
const DEFAULT_REMOTE_DOCKER_URL = 'https://innate-eudemonistically-sharita.ngrok-free.dev';

function normalizeTradingMode(value?: string): IbkrTradingMode {
    return value === 'live' ? 'live' : 'paper';
}

function normalizeBridgeProfile(value?: string): IbkrBridgeProfile | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase().replace(/-/g, '_');
    switch (normalized) {
        case 'local_mac':
        case 'mac':
        case 'native':
        case 'native_mac':
            return 'local_mac';
        case 'local_docker':
        case 'docker':
            return 'local_docker';
        case 'remote_docker':
        case 'remote':
        case 'ngrok':
            return 'remote_docker';
        default:
            return undefined;
    }
}

function shouldUseProdServices(env: EnvRecord = process.env): boolean {
    return readBoolEnv(env, 'EXPO_PUBLIC_USE_PROD_SERVICES');
}

export function getIbkrBridgeProfile(env: EnvRecord = process.env): IbkrBridgeProfile {
    return normalizeBridgeProfile(
        readEnv(env, 'EXPO_PUBLIC_IBKR_BRIDGE_PROFILE', 'IBKR_BRIDGE_PROFILE')
    ) || DEFAULT_BRIDGE_PROFILE;
}

export function getIbkrTradingMode(env: EnvRecord = process.env): IbkrTradingMode {
    return normalizeTradingMode(
        readEnv(env, 'EXPO_PUBLIC_IB_TRADING_MODE', 'IB_TRADING_MODE', 'TRADING_MODE')
    );
}

function resolveProfileBridgeUrl(profile: IbkrBridgeProfile, env: EnvRecord): string | undefined {
    const suffix = profile.toUpperCase();
    return env[`EXPO_PUBLIC_IBKR_BRIDGE_URL_${suffix}`]
        || env[`IBKR_BRIDGE_URL_${suffix}`];
}

function resolveDefaultBridgeUrl(env: EnvRecord): string {
    return env.EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL
        || env.IBKR_BRIDGE_DEFAULT_URL
        || DEFAULT_REMOTE_DOCKER_URL;
}

function normalizeExplicitBridgeUrl(explicitUrl: string | undefined, env: EnvRecord): string | undefined {
    if (!explicitUrl) return undefined;
    const trimmed = explicitUrl.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const profile = normalizeBridgeProfile(trimmed);
    if (profile) {
        const profileUrl = resolveProfileBridgeUrl(profile, env);
        if (profileUrl) return profileUrl;
    }

    if (/^[\\w.-]+:\\d+$/.test(trimmed)) {
        return `http://${trimmed}`;
    }

    return undefined;
}

export function getIbkrBridgeUrl(env: EnvRecord = process.env): string {
    const explicitUrl = env.EXPO_PUBLIC_IBKR_BRIDGE_URL
        || env.IBKR_BRIDGE_URL;
    const normalizedExplicit = normalizeExplicitBridgeUrl(explicitUrl, env);
    if (normalizedExplicit) return normalizedExplicit;

    const profile = getIbkrBridgeProfile(env);
    const profileUrl = resolveProfileBridgeUrl(profile, env);
    if (profileUrl) return profileUrl;

    const useProd = shouldUseProdServices(env);
    const prodUrl = env.EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD
        || env.IBKR_BRIDGE_URL_PROD;
    return (useProd ? prodUrl : undefined)
        || prodUrl
        || resolveDefaultBridgeUrl(env);
}

export function getIbkrBridgeApiKey(env: EnvRecord = process.env): string {
    return env.IBKR_BRIDGE_API_KEY
        || env.BRIDGE_API_KEY
        || env.EXPO_PUBLIC_IBKR_BRIDGE_API_KEY
        || '';
}

export function isIbkrBridgeUrlConfigured(env: EnvRecord = process.env): boolean {
    return Boolean(
        env.EXPO_PUBLIC_IBKR_BRIDGE_URL
        || env.IBKR_BRIDGE_URL
        || env.EXPO_PUBLIC_IBKR_BRIDGE_URL_LOCAL_MAC
        || env.IBKR_BRIDGE_URL_LOCAL_MAC
        || env.EXPO_PUBLIC_IBKR_BRIDGE_URL_LOCAL_DOCKER
        || env.IBKR_BRIDGE_URL_LOCAL_DOCKER
        || env.EXPO_PUBLIC_IBKR_BRIDGE_URL_REMOTE_DOCKER
        || env.IBKR_BRIDGE_URL_REMOTE_DOCKER
        || env.EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD
        || env.IBKR_BRIDGE_URL_PROD
        || env.EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL
        || env.IBKR_BRIDGE_DEFAULT_URL
    );
}

export function getIbkrConfig(env: EnvRecord = process.env) {
    return {
        tradingMode: getIbkrTradingMode(env),
        bridgeProfile: getIbkrBridgeProfile(env),
        bridgeUrl: getIbkrBridgeUrl(env),
        bridgeApiKey: getIbkrBridgeApiKey(env),
        bridgeUrlConfigured: isIbkrBridgeUrlConfigured(env),
    };
}
