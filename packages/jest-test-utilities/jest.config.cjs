const { createJsWithTsEsmPreset } = require('ts-jest');
const preset = createJsWithTsEsmPreset();

const jestConfig = {
  ...preset,
  verbose: true,
  testEnvironment: './src/jest-environment.ts',
  globalSetup: './src/jest-global-setup.ts',
  globalTeardown: './src/jest-global-teardown.ts',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};

module.exports = jestConfig;
