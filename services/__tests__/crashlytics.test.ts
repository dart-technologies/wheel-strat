import { NativeModules, Platform } from 'react-native';
import { initCrashlytics } from '../crashlytics.native';

jest.mock('react-native', () => ({
    NativeModules: {
        RNFBAppModule: {},
        RNFBCrashlyticsModule: {}
    },
    Platform: {
        OS: 'ios'
    }
}));

jest.mock('@react-native-firebase/crashlytics', () => {
    const mockSetCrashlyticsCollectionEnabled = jest.fn();
    const mockCrashlyticsInstance = {
        setCrashlyticsCollectionEnabled: mockSetCrashlyticsCollectionEnabled,
    };
    const mockGetCrashlytics = jest.fn(() => mockCrashlyticsInstance);

    return {
        __esModule: true,
        getCrashlytics: mockGetCrashlytics,
        setCrashlyticsCollectionEnabled: mockSetCrashlyticsCollectionEnabled,
    };
});

// Helper to get mocks
const getMocks = () => {
    const crashlytics = require('@react-native-firebase/crashlytics');
    return {
        getCrashlytics: crashlytics.getCrashlytics,
        setCrashlyticsCollectionEnabled: crashlytics.setCrashlyticsCollectionEnabled,
    };
};

describe('initCrashlytics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks for each test
        (Platform as any).OS = 'ios';
        (NativeModules as any).RNFBAppModule = {};
        (NativeModules as any).RNFBCrashlyticsModule = {};
    });

    it('initializes crashlytics when modules are present on iOS', async () => {
        const { getCrashlytics: mockGetter, mockSetEnabled } = {
            getCrashlytics: require('@react-native-firebase/crashlytics').getCrashlytics,
            mockSetEnabled: require('@react-native-firebase/crashlytics').setCrashlyticsCollectionEnabled
        };

        await initCrashlytics();

        expect(mockGetter).toHaveBeenCalled();
        const instance = (mockGetter as jest.Mock).mock.results[0].value;
        expect(mockSetEnabled).toHaveBeenCalledWith(instance, true);
    });

    it('does nothing on non-iOS platforms', async () => {
        const { getCrashlytics: mockGetter } = getMocks();
        (Platform as any).OS = 'android';
        await initCrashlytics();
        expect(mockGetter).not.toHaveBeenCalled();
    });

    it('does nothing if RNFBAppModule is missing', async () => {
        const { getCrashlytics: mockGetter } = getMocks();
        delete (NativeModules as any).RNFBAppModule;
        await initCrashlytics();
        expect(mockGetter).not.toHaveBeenCalled();
    });

    it('does nothing if RNFBCrashlyticsModule is missing', async () => {
        const { getCrashlytics: mockGetter } = getMocks();
        delete (NativeModules as any).RNFBCrashlyticsModule;
        await initCrashlytics();
        expect(mockGetter).not.toHaveBeenCalled();
    });
});
