import { jest } from '@jest/globals';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('firebase/app', () => {
    const apps = [];
    const initializeApp = jest.fn((options = {}) => {
        const app = { options, name: 'test-app' };
        apps.push(app);
        return app;
    });
    const getApps = jest.fn(() => apps);
    const getApp = jest.fn(() => apps[0] || { options: {} });
    return {
        initializeApp,
        getApps,
        getApp,
    };
});

jest.mock('firebase/auth', () => {
    const authInstance = { currentUser: null };
    return {
        getAuth: jest.fn(() => authInstance),
        initializeAuth: jest.fn(() => authInstance),
        getReactNativePersistence: jest.fn(() => ({})),
    };
});

jest.mock('firebase/firestore', () => {
    const dbInstance = {};
    return {
        getFirestore: jest.fn(() => dbInstance),
        initializeFirestore: jest.fn(() => dbInstance),
        connectFirestoreEmulator: jest.fn(),
    };
});

jest.mock('firebase/functions', () => {
    const functionsInstance = {};
    return {
        getFunctions: jest.fn(() => functionsInstance),
        connectFunctionsEmulator: jest.fn(),
    };
});

jest.mock('expo-glass-effect', () => {
    const React = require('react');
    const { View } = require('react-native');
    const GlassView = ({ children, ...props }) => React.createElement(View, props, children);
    GlassView.displayName = 'ViewManagerAdapter_ExpoGlassEffect';
    return {
        GlassView,
        GlassContainer: GlassView,
        GlassStyle: {},
    };
});

// Mock @react-native-firebase/app
jest.mock('@react-native-firebase/app', () => {
    const appInstance = { options: {} };
    const firebase = {
        app: jest.fn(() => appInstance),
        apps: [appInstance],
    };
    return {
        firebase,
        getApp: jest.fn(() => appInstance),
        initializeApp: jest.fn(),
        app: jest.fn(() => appInstance),
        utils: jest.fn(() => ({
            FilePath: {
                PICTURES_DIRECTORY: 'test-path',
            },
        })),
    };
});

// Mock @react-native-firebase/analytics
jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({
        logEvent: jest.fn(),
        setAnalyticsCollectionEnabled: jest.fn(),
        setCurrentScreen: jest.fn(),
        setUserId: jest.fn(),
        setUserProperty: jest.fn(),
    })),
    logEvent: jest.fn(),
}));

// Mock @react-native-firebase/auth
jest.mock('@react-native-firebase/auth', () => ({
    getAuth: jest.fn(() => ({
        onAuthStateChanged: jest.fn(),
        signInWithCredential: jest.fn(),
        signOut: jest.fn(),
        currentUser: null,
    })),
    onAuthStateChanged: jest.fn((_auth, callback) => {
        if (typeof callback === 'function') {
            callback(null);
        }
        return () => {};
    }),
    GoogleAuthProvider: {
        credential: jest.fn(),
    },
    AppleAuthProvider: {
        credential: jest.fn(),
    },
}));

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => {
    const mockDb = {};
    const mockQuery = {};
    const getFirestore = jest.fn(() => mockDb);
    const collection = jest.fn(() => mockQuery);
    const query = jest.fn(() => mockQuery);
    const where = jest.fn();
    const orderBy = jest.fn();
    const limit = jest.fn();
    const onSnapshot = jest.fn();
    const getDocs = jest.fn();
    const doc = jest.fn(() => ({}));
    const getDoc = jest.fn();
    const setDoc = jest.fn();
    const serverTimestamp = jest.fn();
    const firestore = jest.fn(() => mockDb);
    firestore.FieldValue = { serverTimestamp };
    return {
        __esModule: true,
        default: firestore,
        getFirestore,
        collection,
        query,
        where,
        orderBy,
        limit,
        onSnapshot,
        getDocs,
        doc,
        getDoc,
        setDoc,
        serverTimestamp,
    };
}, { virtual: true });

// Mock @react-native-firebase/crashlytics
const mockCrashlyticsInstance = {
    setCrashlyticsCollectionEnabled: jest.fn(),
    log: jest.fn(),
    recordError: jest.fn(),
};

jest.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: jest.fn(() => mockCrashlyticsInstance),
    setCrashlyticsCollectionEnabled: jest.fn(),
    log: jest.fn(),
    recordError: jest.fn(),
}));

// Mock @react-native-firebase/functions
jest.mock('@react-native-firebase/functions', () => {
    const callable = jest.fn(async () => ({
        data: { success: true, newFills: 5 },
    }));
    const httpsCallable = jest.fn(() => callable);
    return {
        getFunctions: jest.fn(() => ({ httpsCallable })),
        connectFunctionsEmulator: jest.fn(),
        httpsCallable,
    };
});

// Mock react-native-safe-area-context hooks for tests
jest.mock('react-native-safe-area-context', () => {
    const actual = jest.requireActual('react-native-safe-area-context');
    return {
        ...actual,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const originalWarn = console.warn;
const suppressedWarnings = new Set();
console.warn = (...args) => {
    const [message] = args;
    if (typeof message === 'string' && message.includes('NativeViewManagerAdapter')) {
        if (suppressedWarnings.has(message)) {
            return;
        }
        suppressedWarnings.add(message);
    }
    originalWarn(...args);
};
