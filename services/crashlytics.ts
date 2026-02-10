import { initCrashlyticsCore } from './crashlytics.core';

export async function initCrashlytics() {
    return initCrashlyticsCore({
        platform: 'web',
        isDev: false,
        hasAppModule: false,
        hasCrashlyticsModule: false
    });
}
