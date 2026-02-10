const DEFAULT_REMOTE_DOCKER_URL = 'https://innate-eudemonistically-sharita.ngrok-free.dev';

const getDefaultBridgeUrl = (env) => (
    env.EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL
    || env.IBKR_BRIDGE_DEFAULT_URL
    || DEFAULT_REMOTE_DOCKER_URL
);

const normalizeProfile = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase().replace(/-/g, '_');
    if (['local_mac', 'local_docker', 'remote_docker'].includes(normalized)) return normalized;
    if (['mac', 'native', 'native_mac'].includes(normalized)) return 'local_mac';
    if (['docker', 'dock'].includes(normalized)) return 'local_docker';
    if (['remote', 'ngrok'].includes(normalized)) return 'remote_docker';
    return null;
};

const getBridgeProfile = (env = process.env) => (
    normalizeProfile(env.EXPO_PUBLIC_IBKR_BRIDGE_PROFILE || env.IBKR_BRIDGE_PROFILE) || 'remote_docker'
);

const getBridgeUrl = (env = process.env, explicitUrl) => {
    const explicit = explicitUrl || env.EXPO_PUBLIC_IBKR_BRIDGE_URL || env.IBKR_BRIDGE_URL;
    if (explicit) {
        const normalizedExplicit = String(explicit).trim();
        if (/^https?:\/\//i.test(normalizedExplicit)) return normalizedExplicit;
        const explicitProfile = normalizeProfile(normalizedExplicit);
        if (explicitProfile) {
            const suffix = explicitProfile.toUpperCase();
            const profileUrl = env[`EXPO_PUBLIC_IBKR_BRIDGE_URL_${suffix}`]
                || env[`IBKR_BRIDGE_URL_${suffix}`];
            if (profileUrl) return profileUrl;
        }
        if (/^[\w.-]+:\d+$/.test(normalizedExplicit)) {
            return `http://${normalizedExplicit}`;
        }
    }

    const profile = getBridgeProfile(env);
    const suffix = profile.toUpperCase();
    const profileUrl = env[`EXPO_PUBLIC_IBKR_BRIDGE_URL_${suffix}`]
        || env[`IBKR_BRIDGE_URL_${suffix}`];
    if (profileUrl) return profileUrl;

    const prodUrl = env.EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD || env.IBKR_BRIDGE_URL_PROD;
    const useProdServices = env.EXPO_PUBLIC_USE_PROD_SERVICES === 'true';
    return (useProdServices ? prodUrl : undefined) || prodUrl || getDefaultBridgeUrl(env);
};

const getBridgeApiKey = (env = process.env, explicitKey) => (
    explicitKey
    || env.IBKR_BRIDGE_API_KEY
    || env.BRIDGE_API_KEY
    || env.EXPO_PUBLIC_IBKR_BRIDGE_API_KEY
    || ''
);

module.exports = {
    DEFAULT_REMOTE_DOCKER_URL,
    getDefaultBridgeUrl,
    normalizeProfile,
    getBridgeProfile,
    getBridgeUrl,
    getBridgeApiKey
};
