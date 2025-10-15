const { createJsWithTsEsmPreset } = require('ts-jest');
const preset = createJsWithTsEsmPreset();

const jestConfig = {
  ...preset,
  verbose: true,
  coverageReporters: ['lcov', 'text'],
  collectCoverage: false,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  testEnvironment: '../test-utilities/src/jest-environment.ts',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@goodfoot/test-utilities/(.*)$': '<rootDir>/../test-utilities/src/$1'
  },
  extensionsToTreatAsEsm: ['.ts']
};

module.exports = jestConfig;
