module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    verbose: true,
    watchman: false,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@wheel-strat/shared$': '<rootDir>/../packages/shared/src/index.ts',
        '^@wheel-strat/shared/(.*)$': '<rootDir>/../packages/shared/src/$1'
    }
};
