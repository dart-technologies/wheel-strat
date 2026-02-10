import { getAuth as getWebAuth } from 'firebase/auth';
import { getAuth as getNativeAuth } from '@react-native-firebase/auth';
import { getApp as getNativeApp } from '@react-native-firebase/app';
import { getApp as getWebApp } from 'firebase/app';
import { Config } from '@/config';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { createAuthDiagnostics } from './authDiagnostics.core';

const diagnostics = createAuthDiagnostics({
    primaryLabel: 'native',
    secondaryLabel: 'web',
    getPrimaryAuth: () => getNativeAuth(),
    getSecondaryAuth: () => getWebAuth(),
    getPrimaryProjectId: () => getNativeApp().options?.projectId ?? null,
    getSecondaryProjectId: () => getWebApp().options?.projectId ?? null,
    ensureAuthReady: ensureFirestoreAuthReady,
    useEmulator: Config.firebase.useEmulator
});

export const logAuthSnapshotOnce = diagnostics.logAuthSnapshotOnce;
