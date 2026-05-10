module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    testTimeout: 30000,
    setupFilesAfterEnv: [],
    modulePathIgnorePatterns: ['<rootDir>/node_modules/']
};