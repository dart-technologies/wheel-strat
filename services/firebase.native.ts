import { getApp } from '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable as modularHttpsCallable } from '@react-native-firebase/functions';
import { Config } from '@/config';
import { createAuthHelpers } from './firebaseAuth.core';

const app = getApp();
const auth = getAuth();
const db = getFirestore();
const functions = getFunctions();

const authHelpers = createAuthHelpers({
    label: 'native',
    getAuth: () => auth,
    signInAnonymously: undefined, // Disabled to enforce native auth
    onAuthStateChanged: (authInstance, handler) => onAuthStateChanged(authInstance as any, handler as any)
});

export const ensureFirestoreAuthReady = authHelpers.ensureAuthReady;

// authHelpers.ensureAnonymousAuth(); // Disabled: Stop creating multiple anonymous users

if (Config.firebase.emulatorForcedOff && Config.firebase.requestedUseEmulator) {
    console.warn('[firebase] Emulator disabled on physical device for local_mac profile.');
}

if (Config.firebase.useEmulator && !Config.useProdServices) {
    const host = Config.firebase.emulatorHost;
    const functionsPort = Config.firebase.functionsEmulatorPort;
    const firestorePort = Config.firebase.firestoreEmulatorPort;

    console.log(`🔌 Connecting to Firebase Emulators at ${host}`);
    if (db.useEmulator) {
        db.useEmulator(host, firestorePort);
    }
    functions.useEmulator(host, functionsPort);
}

export const httpsCallable = <Req, Res>(name: string, options?: { timeout: number }) => {
    // We use a getter-like approach to ensure the mock is picked up in tests
    const functionsInstance = getFunctions();
    const callable = modularHttpsCallable<Req, Res>(functionsInstance, name, options);
    return (data: Req) => callable(data);
};

export { app, auth, db, functions };