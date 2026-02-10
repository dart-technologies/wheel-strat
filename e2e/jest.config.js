module.exports = {
    testTimeout: 180000,
    maxWorkers: 1,
    testEnvironment: 'detox/runners/jest/testEnvironment',
    setupFilesAfterEnv: ['<rootDir>/setup.js'],
    globalSetup: 'detox/runners/jest/globalSetup',
    globalTeardown: 'detox/runners/jest/globalTeardown',
    reporters: ['detox/runners/jest/reporter'],
    testMatch: ['**/*.e2e.js'],
    verbose: true,
};
