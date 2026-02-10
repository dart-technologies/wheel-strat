import { FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
// @ts-ignore
import { Auth, getAuth, initializeAuth, getReactNativePersistence, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Firestore, getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { Functions, getFunctions, connectFunctionsEmulator, httpsCallable as webHttpsCallable } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '@/config';
import { createAuthHelpers } from './firebaseAuth.core';

const firebaseConfig = {
    apiKey: Config.firebase.apiKey,
    authDomain: Config.firebase.authDomain,
    projectId: Config.firebase.projectId,
    storageBucket: Config.firebase.storageBucket,
    messagingSenderId: Config.firebase.messagingSenderId,
    appId: Config.firebase.appId,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
    db = initializeFirestore(app, {
        experimentalForceLongPolling: true, 
    });
    functions = getFunctions(app);

    if (Config.firebase.emulatorForcedOff && Config.firebase.requestedUseEmulator) {
        console.warn('[firebase] Emulator disabled on physical device for local_mac profile.');
    }
    if (Config.firebase.useEmulator && !Config.useProdServices) {
        const host = Config.firebase.emulatorHost;
        const functionsPort = Config.firebase.functionsEmulatorPort;
        const firestorePort = Config.firebase.firestoreEmulatorPort;
        
        console.log(`🔌 Connecting to Firebase Emulators at ${host}`);
        connectFirestoreEmulator(db, host, firestorePort);
        connectFunctionsEmulator(functions, host, functionsPort);
    }
} else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
}

const authHelpers = createAuthHelpers({
    label: 'web',
    getAuth: () => auth,
    signInAnonymously: undefined, // Disabled to enforce native auth
    onAuthStateChanged: (authInstance, handler) => onAuthStateChanged(authInstance as any, handler as any)
});

// authHelpers.ensureAnonymousAuth(); // Disabled: Stop creating multiple anonymous users

export const ensureFirestoreAuthReady = authHelpers.ensureAuthReady;

export const httpsCallable = <Req, Res>(name: string, options?: { timeout: number }) => {
    return (data: Req) => webHttpsCallable<Req, Res>(functions, name, options)(data);
};

export { app, auth, db, functions };