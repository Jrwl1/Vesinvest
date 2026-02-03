/**
 * Suppress ts-jest version warning for TypeScript 5.x
 * ts-jest 27.x predates TS 5.x but works correctly for our use case.
 * See: https://github.com/kulshekhar/ts-jest/issues/4198
 */
process.env.TS_JEST_DISABLE_VER_CHECKER = '1';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@packages/domain$': '<rootDir>/../../packages/domain/src',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
};
