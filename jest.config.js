module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/cloud'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
  collectCoverageFrom: [
    'cloud/**/*.js',
    'index.js',
    '!**/node_modules/**'
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  testTimeout: 10000,
  forceExit: true
};
