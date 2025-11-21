const { createJsWithTsEsmPreset } = require('ts-jest');
const preset = createJsWithTsEsmPreset();

const jestConfig = {
  ...preset,
  verbose: true,
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@goodfoot/jest-test-utilities/(.*)$': '<rootDir>/../../jest-test-utilities/src/$1'
  },
  extensionsToTreatAsEsm: ['.ts']
};

module.exports = jestConfig;
