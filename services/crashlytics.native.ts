import { NativeModules, Platform } from 'react-native';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { initCrashlyticsCore } from './crashlytics.core';

/**
 * Initializes Crashlytics only if the native module is available
 * and current platform is iOS.
 */
export async function initCrashlytics(): Promise<void> {
    const hasAppModule = !!NativeModules?.RNFBAppModule;
    const hasCrashlyticsModule = !!NativeModules?.RNFBCrashlyticsModule;

    return initCrashlyticsCore({
        platform: Platform.OS,
        isDev: __DEV__,
        hasAppModule,
        hasCrashlyticsModule,
        getCrashlytics,
        setCollectionEnabled: async (instance, enabled) => {
            await setCrashlyticsCollectionEnabled(instance as any, enabled);
        }
    });
}
