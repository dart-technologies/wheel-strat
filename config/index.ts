import Constants from 'expo-constants';
import { z } from 'zod';
import { getIbkrBridgeProfile } from '@wheel-strat/shared';

type RawRecord = Record<string, unknown>;

const booleanValue = z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
}, z.boolean());

const numberValue = z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}, z.number().int());

const optionalString = z.preprocess((value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (value == null) return undefined;
    return String(value);
}, z.string()).optional();

const FirebaseSchema = z.object({
    apiKey: optionalString,
    authDomain: optionalString,
    projectId: optionalString,
    storageBucket: optionalString,
    messagingSenderId: optionalString,
    appId: optionalString,
    useEmulator: booleanValue.default(false),
    emulatorHost: optionalString.default('localhost'),
    functionsEmulatorPort: numberValue.default(5001),
    firestoreEmulatorPort: numberValue.default(8080),
});

const AppConfigSchema = z.object({
    useProdServices: booleanValue.default(false),
    bridgeProfile: optionalString,
    firebase: FirebaseSchema.default({}),
});

function getExtraRecord(value: unknown): RawRecord {
    return typeof value === 'object' && value !== null ? value as RawRecord : {};
}

const extra = getExtraRecord(Constants.expoConfig?.extra);
const firebaseExtra = getExtraRecord(extra.firebase);
const easExtra = getExtraRecord(extra.eas);

const rawConfig = {
    useProdServices: extra.useProdServices,
    bridgeProfile: extra.ibkrBridgeProfile,
    firebase: {
        apiKey: firebaseExtra.apiKey,
        authDomain: firebaseExtra.authDomain,
        projectId: firebaseExtra.projectId,
        storageBucket: firebaseExtra.storageBucket,
        messagingSenderId: firebaseExtra.messagingSenderId,
        appId: firebaseExtra.appId,
        useEmulator: firebaseExtra.useEmulator,
        emulatorHost: firebaseExtra.emulatorHost,
        functionsEmulatorPort: firebaseExtra.functionsEmulatorPort,
        firestoreEmulatorPort: firebaseExtra.firestoreEmulatorPort,
    },
};

const parsed = AppConfigSchema.safeParse(rawConfig);
if (!parsed.success) {
    console.warn('[config] Invalid env values detected; using defaults.', parsed.error.flatten().fieldErrors);
}
const baseConfig = parsed.success ? parsed.data : AppConfigSchema.parse({});

const bridgeEnv = { ...process.env };
if (baseConfig.bridgeProfile) {
    bridgeEnv.EXPO_PUBLIC_IBKR_BRIDGE_PROFILE = baseConfig.bridgeProfile;
    bridgeEnv.IBKR_BRIDGE_PROFILE = baseConfig.bridgeProfile;
}
const bridgeProfile = getIbkrBridgeProfile(bridgeEnv);

const requestedUseEmulator = baseConfig.firebase.useEmulator;
const emulatorForcedOff = Boolean(Constants.isDevice) && bridgeProfile === 'local_mac';
const effectiveUseEmulator = emulatorForcedOff ? false : requestedUseEmulator;

const expoProjectId = typeof easExtra.projectId === 'string'
    ? easExtra.projectId
    : (Constants.easConfig?.projectId || baseConfig.firebase.projectId);

export const Config = {
    useProdServices: baseConfig.useProdServices,
    bridgeProfile,
    expo: {
        projectId: expoProjectId,
    },
    firebase: {
        ...baseConfig.firebase,
        useEmulator: effectiveUseEmulator,
        requestedUseEmulator,
        emulatorForcedOff,
    },
};

export type AppConfig = typeof Config;
