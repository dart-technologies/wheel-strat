type CrashlyticsDeps = {
    platform: string;
    isDev: boolean;
    hasAppModule: boolean;
    hasCrashlyticsModule: boolean;
    getCrashlytics?: () => unknown;
    setCollectionEnabled?: (instance: unknown, enabled: boolean) => Promise<void>;
};

export const initCrashlyticsCore = async (deps: CrashlyticsDeps): Promise<void> => {
    if (deps.platform !== 'ios') return;
    if (!deps.getCrashlytics || !deps.setCollectionEnabled) return;

    if (!deps.hasAppModule || !deps.hasCrashlyticsModule) {
        if (deps.isDev) {
            console.warn('Crashlytics unavailable: @react-native-firebase/app or @react-native-firebase/crashlytics native module is missing.');
        }
        return;
    }

    try {
        const crashlytics = deps.getCrashlytics();
        await deps.setCollectionEnabled(crashlytics, true);

        if (deps.isDev) {
            console.log('Crashlytics initialized successfully');
        }
    } catch (error) {
        if (deps.isDev) {
            console.error('Failed to initialize Crashlytics:', error);
        }
    }
};
