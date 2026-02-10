const { withPodfile } = require('@expo/config-plugins');

/**
 * Highly targeted plugin to resolve "include of non-modular header" errors
 * on RN 0.81+ by disabling module maps for the RNFB wrapper pods only.
 */
const withModularHeaders = (config) => {
    return withPodfile(config, (config) => {
        let podfileContents = config.modResults.contents;

        const buildSettingsSnippet = `
    # Added by withModularHeaders plugin to support Firebase + static frameworks + RN 0.81
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # 1. Allow non-modular includes globally
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # 2. Specifically disable module definition for RNFB wrapper pods.
        # This prevents them from "claiming" React headers in a way that conflicts
        # with other modules. We do NOT do this for 'Firebase' pods as they are 
        # Swift-based and require modules.
        if target.name.start_with?('RNFB')
          config.build_settings['DEFINES_MODULE'] = 'NO'
          # Also ensure Clang doesn't treat non-modular includes as errors
          config.build_settings['OTHER_CFLAGS'] ||= '$(inherited)'
          config.build_settings['OTHER_CFLAGS'] << ' -Wno-non-modular-include'
        end
      end
    end
`;

        if (!podfileContents.includes('Firebase + static frameworks + RN 0.81')) {
            if (podfileContents.includes('post_install do |installer|')) {
                podfileContents = podfileContents.replace(
                    'post_install do |installer|',
                    `post_install do |installer|${buildSettingsSnippet}`
                );
            }
        }

        config.modResults.contents = podfileContents;
        return config;
    });
};

module.exports = withModularHeaders;
