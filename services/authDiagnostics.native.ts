import { getAuth as getNativeAuth } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { Config } from '@/config';
import { ensureFirestoreAuthReady } from '@/services/firebase';
import { createAuthDiagnostics } from './authDiagnostics.core';

const diagnostics = createAuthDiagnostics({
    primaryLabel: 'native',
    getPrimaryAuth: () => getNativeAuth(),
    getPrimaryProjectId: () => getApp().options?.projectId ?? null,
    ensureAuthReady: ensureFirestoreAuthReady,
    useEmulator: Config.firebase.useEmulator
});

export const logAuthSnapshotOnce = diagnostics.logAuthSnapshotOnce;
