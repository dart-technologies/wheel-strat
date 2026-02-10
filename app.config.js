const appVariant = process.env.APP_VARIANT;
const useProdServicesEnv = process.env.EXPO_PUBLIC_USE_PROD_SERVICES;
const useProdServices = typeof useProdServicesEnv === 'string'
    ? useProdServicesEnv === 'true'
    : appVariant === 'production';

module.exports = ({ config }) => ({
    ...config,
    name: "Wheel Strat",
    slug: "wheel-strat",
    version: "1.54.7",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "wheel-strat",
    userInterfaceStyle: "dark",
    ios: {
        supportsTablet: true,
        bundleIdentifier: "art.dart.wheelstrat",
        googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST || "./config/firebase/GoogleService-Info.plist",
        infoPlist: {
            ITSAppUsesNonExemptEncryption: false
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/images/icon.png",
            backgroundColor: "#0F172A"
        },
        package: "art.dart.wheelstrat"
    },
    web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/icon.png"
    },
    plugins: [
        "expo-router",
        "expo-font",
        "expo-sqlite",
        [
            "@react-native-firebase/app",
            {
                ios: {
                    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST || "./config/firebase/GoogleService-Info.plist"
                }
            }
        ],
        [
            "expo-build-properties",
            {
                ios: {
                    useFrameworks: 'static'
                }
            }
        ],
        [
            'expo-splash-screen',
            {
                'backgroundColor': '#0F172A',
                'image': './assets/images/icon.png',
                'imageWidth': 200
            }
        ],
        "@react-native-firebase/crashlytics",
        "@react-native-google-signin/google-signin",
        "expo-apple-authentication",
        "expo-video",
        "./plugins/withModularHeaders"
    ],
    experiments: {
        typedRoutes: true
    },
    extra: {
        useProdServices,
        ibkrBridgeProfile: process.env.EXPO_PUBLIC_IBKR_BRIDGE_PROFILE,
        router: {},
        eas: {
            projectId: "882b8fac-01f5-4f4e-9c35-dc19aebc6478"
        },
        firebase: {
            apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
            useEmulator: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true',
            emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
            functionsEmulatorPort: process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT,
            firestoreEmulatorPort: process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT
        }
    },
    owner: "dart-technologies"
});
