const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules ?? {}),
    "@wheel-strat/shared": path.join(projectRoot, "packages/shared"),
};

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['import', 'require', 'default'];

module.exports = config;
