const appConfig = require('../app.config.js');

describe('app.config', () => {
    it('contains essential firebase plugins', () => {
        const config = typeof appConfig === 'function' ? appConfig({ config: {} }) : appConfig;
        const plugins = config.plugins;

        const hasPlugin = (name: string) => plugins.some((p: any) => p === name || (Array.isArray(p) && p[0] === name));

        expect(hasPlugin('@react-native-firebase/app')).toBe(true);
        expect(hasPlugin('@react-native-firebase/crashlytics')).toBe(true);
    });

    it('includes the modular headers plugin', () => {
        const config = typeof appConfig === 'function' ? appConfig({ config: {} }) : appConfig;
        const plugins = config.plugins;

        expect(plugins).toContain('./plugins/withModularHeaders');
    });

    it('sets useFrameworks to static', () => {
        const config = typeof appConfig === 'function' ? appConfig({ config: {} }) : appConfig;
        const buildProperties = config.plugins.find(
            (p: any) => Array.isArray(p) && p[0] === 'expo-build-properties'
        );

        expect(buildProperties).toBeDefined();
        expect(buildProperties[1].ios.useFrameworks).toBe('static');
    });
});
