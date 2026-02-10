// We mock @expo/config-plugins to capture the callback passed to withPodfile
let capturedCallback: any;
jest.mock('@expo/config-plugins', () => ({
  withPodfile: jest.fn((config, callback) => {
    capturedCallback = callback;
    return config;
  })
}));

const withModularHeaders = require('../withModularHeaders');

describe('withModularHeaders', () => {
  it('correctly injects build settings into Podfile', () => {
    const mockConfig = {
      modResults: {
        contents: `
target 'WheelStrat' do
  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
        `
      }
    };

    // 1. Register the plugin
    withModularHeaders(mockConfig);

    // 2. Execute the captured callback
    const updatedConfig = capturedCallback(mockConfig);
    const contents = updatedConfig.modResults.contents;

    expect(contents).toContain("config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'");
    expect(contents).toContain("if target.name.start_with?('RNFB')");
    expect(contents).toContain("config.build_settings['DEFINES_MODULE'] = 'NO'");
    expect(contents).toContain("post_install do |installer|");
  });

  it('does not double-inject if settings already exist', () => {
    const snippet = "Firebase + static frameworks + RN 0.81";
    const mockConfig = {
      modResults: {
        contents: `
target 'WheelStrat' do
  post_install do |installer|
    # ${snippet}
    react_native_post_install(installer, config[:reactNativePath])
  end
end
        `
      }
    };

    withModularHeaders(mockConfig);
    const updatedConfig = capturedCallback(mockConfig);

    const occurrences = (updatedConfig.modResults.contents.match(new RegExp("RN 0.81", 'g')) || []).length;
    expect(occurrences).toBe(1);
  });
});
