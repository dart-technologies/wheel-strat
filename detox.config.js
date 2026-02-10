const appName = process.env.DETOX_APP_NAME || 'WheelStrat';
const iosScheme = process.env.DETOX_IOS_SCHEME || appName;
const iosWorkspace = process.env.DETOX_IOS_WORKSPACE || `ios/${appName}.xcworkspace`;

module.exports = {
    testRunner: {
        args: {
            $0: 'jest',
            config: 'e2e/jest.config.js',
        },
        jest: {
            setupTimeout: 120000,
        },
    },
    apps: {
        'ios.debug': {
            type: 'ios.app',
            binaryPath: `ios/build/Build/Products/Debug-iphonesimulator/${appName}.app`,
            build: [
                'expo prebuild --platform ios',
                `xcodebuild -workspace ${iosWorkspace} -scheme ${iosScheme} -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build`
            ].join(' && ')
        },
        'ios.release': {
            type: 'ios.app',
            binaryPath: `ios/build/Build/Products/Release-iphonesimulator/${appName}.app`,
            build: [
                'expo prebuild --platform ios',
                `xcodebuild -workspace ${iosWorkspace} -scheme ${iosScheme} -configuration Release -sdk iphonesimulator -derivedDataPath ios/build`
            ].join(' && ')
        },
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            build: [
                'expo prebuild --platform android',
                'cd android',
                './gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'
            ].join(' && ')
        }
    },
    devices: {
        simulator: {
            type: 'ios.simulator',
            device: {
                type: process.env.DETOX_IOS_DEVICE || 'iPhone 17 Pro'
            }
        },
        emulator: {
            type: 'android.emulator',
            device: {
                avdName: process.env.DETOX_ANDROID_AVD || 'Pixel_6_API_34'
            }
        }
    },
    configurations: {
        'ios.sim.debug': {
            device: 'simulator',
            app: 'ios.debug'
        },
        'ios.sim.release': {
            device: 'simulator',
            app: 'ios.release'
        },
        'android.emu.debug': {
            device: 'emulator',
            app: 'android.debug'
        }
    },
    artifacts: {
        plugins: {
            log: { enabled: true },
            screenshot: {
                shouldTakeAutomaticCapture: true,
                keepOnlyFailedTestsArtifacts: true,
                takeWhen: {
                    testStart: false,
                    testDone: true,
                    testFail: true,
                },
            },
            video: { enabled: false },
        },
    },
};
