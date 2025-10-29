const { createJsWithTsEsmPreset } = require('ts-jest');
const preset = createJsWithTsEsmPreset();

const jestConfig = {
  ...preset,
  verbose: true,
  coverageReporters: ['lcov', 'text'],
  collectCoverage: false,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js': '$1'
  }
};

module.exports = jestConfig;