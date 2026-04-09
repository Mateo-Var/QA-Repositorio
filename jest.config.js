/** @type {import('jest').Config} */
module.exports = {
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverage: true,
  collectCoverageFrom: ['tests/helpers/**/*.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 70, statements: 70 },
  },
  testEnvironment: 'node',
};
