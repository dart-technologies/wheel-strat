#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../lib/env');

const cwd = process.cwd();

const args = process.argv.slice(2);

const getArgValue = (flag) => {
    const direct = args.find((arg) => arg.startsWith(`${flag}=`));
    if (direct) return direct.split('=')[1];
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
        return args[index + 1];
    }
    return undefined;
};

const strict = args.includes('--strict');
const skipEas = args.includes('--skip-eas');
const targetValue = getArgValue('--target') || 'all';
const profileOverride = getArgValue('--profile');
const targets = new Set(targetValue.split(',').map((value) => value.trim()).filter(Boolean));

const includeApp = targets.has('all') || targets.has('app');
const includeFunctions = targets.has('all') || targets.has('functions');
const includeScripts = targets.has('all') || targets.has('scripts');

const readFirebaseProjectId = () => {
    const candidates = [
        path.join(cwd, '.firebaserc'),
        path.join(cwd, 'config', '.firebaserc')
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        try {
            const raw = fs.readFileSync(candidate, 'utf8');
            const parsed = JSON.parse(raw);
            const defaultProject = parsed?.projects?.default;
            if (typeof defaultProject === 'string' && defaultProject.trim()) {
                return defaultProject.trim();
            }
        } catch (error) {
            console.warn(`[validate_ibkr_env] ${path.basename(candidate)} parse failed; skipping Firebase project env resolution.`);
        }
    }
    return undefined;
};

const firebaseProjectId = readFirebaseProjectId();
const functionsProjectEnvFiles = firebaseProjectId
    ? [
        `functions/.env.${firebaseProjectId}`,
        `functions/.env.${firebaseProjectId}.local`
    ]
    : [];

const loaded = loadEnv({
    cwd,
    files: [
        '.env',
        '.env.local',
        'functions/.env',
        'functions/.env.local',
        ...functionsProjectEnvFiles
    ]
});

const normalizeProfile = (value) => {
    if (!value) return undefined;
    const normalized = String(value).trim().toLowerCase().replace(/-/g, '_');
    if (['local_mac', 'local_docker', 'remote_docker'].includes(normalized)) return normalized;
    if (['mac', 'native', 'native_mac'].includes(normalized)) return 'local_mac';
    if (['docker', 'dock'].includes(normalized)) return 'local_docker';
    if (['remote', 'ngrok'].includes(normalized)) return 'remote_docker';
    return undefined;
};

const readEnv = (...keys) => {
    for (const key of keys) {
        if (process.env[key]) return process.env[key];
    }
    return undefined;
};

const hasAny = (keys) => keys.some((key) => Boolean(process.env[key]));

const profile = normalizeProfile(profileOverride || readEnv('EXPO_PUBLIC_IBKR_BRIDGE_PROFILE', 'IBKR_BRIDGE_PROFILE')) || 'remote_docker';
const profileSuffix = profile.toUpperCase();

const statusCounts = { error: 0, warn: 0 };

const report = (level, label, detail) => {
    const prefix = level.toUpperCase().padEnd(5, ' ');
    console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ''}`);
    if (level === 'error') statusCounts.error += 1;
    if (level === 'warn') statusCounts.warn += 1;
};

const reportCheck = (label, ok, levelIfMissing, hint) => {
    if (ok) {
        report('ok', label);
        return;
    }
    report(levelIfMissing, label, hint);
};

console.log('IBKR Env Validation');
console.log(`Loaded env files: ${loaded.length ? loaded.join(', ') : 'none'}`);
console.log(`Bridge profile: ${profile} (suffix ${profileSuffix})`);
console.log('');

if (includeApp) {
    console.log('App (Expo client)');
    reportCheck(
        'EXPO_PUBLIC_IBKR_BRIDGE_API_KEY',
        hasAny(['EXPO_PUBLIC_IBKR_BRIDGE_API_KEY']),
        'error',
        'Required for preview/production client builds'
    );
    reportCheck(
        `EXPO_PUBLIC_IBKR_BRIDGE_URL or EXPO_PUBLIC_IBKR_BRIDGE_URL_${profileSuffix} or EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD`,
        hasAny([
            'EXPO_PUBLIC_IBKR_BRIDGE_URL',
            `EXPO_PUBLIC_IBKR_BRIDGE_URL_${profileSuffix}`,
            'EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD',
            'EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL'
        ]),
        'warn',
        'Missing URL will fall back to default remote bridge'
    );
    reportCheck(
        'EXPO_PUBLIC_IBKR_BRIDGE_PROFILE',
        hasAny(['EXPO_PUBLIC_IBKR_BRIDGE_PROFILE']),
        'warn',
        'Optional; defaults to remote_docker'
    );
    console.log('');
}

if (includeFunctions) {
    console.log('Cloud Functions runtime');
    const hasIbkrKey = Boolean(process.env.IBKR_BRIDGE_API_KEY);
    const hasBridgeKey = Boolean(process.env.BRIDGE_API_KEY);
    reportCheck(
        'IBKR_BRIDGE_API_KEY or BRIDGE_API_KEY',
        hasIbkrKey || hasBridgeKey,
        'error',
        'Required for Functions that call the bridge'
    );
    reportCheck(
        'IBKR_BRIDGE_API_KEY',
        hasIbkrKey,
        'warn',
        'Recommended for Functions params; BRIDGE_API_KEY is fallback only'
    );
    if (!hasIbkrKey && hasBridgeKey) {
        report('warn', 'BRIDGE_API_KEY set without IBKR_BRIDGE_API_KEY', 'Functions params expect IBKR_BRIDGE_API_KEY');
    }
    reportCheck(
        `IBKR_BRIDGE_URL or IBKR_BRIDGE_URL_${profileSuffix} or IBKR_BRIDGE_URL_PROD`,
        hasAny([
            'IBKR_BRIDGE_URL',
            `IBKR_BRIDGE_URL_${profileSuffix}`,
            'IBKR_BRIDGE_URL_PROD',
            'IBKR_BRIDGE_DEFAULT_URL',
            'EXPO_PUBLIC_IBKR_BRIDGE_URL',
            `EXPO_PUBLIC_IBKR_BRIDGE_URL_${profileSuffix}`,
            'EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD',
            'EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL'
        ]),
        'error',
        'Functions treat the bridge as not configured when missing'
    );
    console.log('');
}

if (includeScripts) {
    console.log('Local scripts / bridge');
    reportCheck(
        'IBKR_BRIDGE_API_KEY or BRIDGE_API_KEY (or EXPO_PUBLIC_IBKR_BRIDGE_API_KEY)',
        hasAny(['IBKR_BRIDGE_API_KEY', 'BRIDGE_API_KEY', 'EXPO_PUBLIC_IBKR_BRIDGE_API_KEY']),
        'warn',
        'Required when running local scripts/bridge'
    );
    reportCheck(
        `IBKR_BRIDGE_URL or IBKR_BRIDGE_URL_${profileSuffix} (or EXPO_PUBLIC_IBKR_BRIDGE_URL*)`,
        hasAny([
            'IBKR_BRIDGE_URL',
            `IBKR_BRIDGE_URL_${profileSuffix}`,
            'IBKR_BRIDGE_URL_PROD',
            'IBKR_BRIDGE_DEFAULT_URL',
            'EXPO_PUBLIC_IBKR_BRIDGE_URL',
            `EXPO_PUBLIC_IBKR_BRIDGE_URL_${profileSuffix}`,
            'EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD',
            'EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL'
        ]),
        'warn',
        'Required when running local scripts/bridge'
    );
    console.log('');
}

if (!skipEas) {
    const easPath = path.join(cwd, 'config', 'eas.json');
    if (fs.existsSync(easPath)) {
        console.log('EAS build env (preview/production)');
        const raw = fs.readFileSync(easPath, 'utf8');
        let easConfig;
        try {
            easConfig = JSON.parse(raw);
        } catch (error) {
            report('warn', 'config/eas.json parse failed', 'Skipping EAS checks');
            easConfig = null;
        }
        if (easConfig?.build) {
            const profiles = ['preview', 'production'];
            const easKeys = [
                'EXPO_PUBLIC_IBKR_BRIDGE_API_KEY',
                'EXPO_PUBLIC_IBKR_BRIDGE_PROFILE',
                'EXPO_PUBLIC_IBKR_BRIDGE_URL',
                `EXPO_PUBLIC_IBKR_BRIDGE_URL_${profileSuffix}`,
                'EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD',
                'EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL'
            ];
            profiles.forEach((profileName) => {
                const env = easConfig.build?.[profileName]?.env || {};
                const present = easKeys.filter((key) => env[key] != null);
                const missing = easKeys.filter((key) => env[key] == null);
                const presentLabel = present.length ? present.join(', ') : 'none';
                const missingLabel = missing.length ? missing.join(', ') : 'none';
                console.log(`- ${profileName}: present ${presentLabel}; missing ${missingLabel}`);
            });
        } else {
            report('warn', 'config/eas.json missing build profiles', 'Skipping EAS checks');
        }
        console.log('');
    } else {
        report('warn', 'config/eas.json not found', 'Skipping EAS checks');
        console.log('');
    }
}

if (statusCounts.error && strict) {
    console.log(`Validation failed with ${statusCounts.error} error(s).`);
    process.exit(1);
}

console.log(`Validation complete with ${statusCounts.error} error(s), ${statusCounts.warn} warning(s).`);
