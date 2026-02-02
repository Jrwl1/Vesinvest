module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: [
    './base.js',
    'plugin:@typescript-eslint/recommended',
    'plugin:nestjs',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRoot: './tsconfig.json',
    project: ['./tsconfig.json'],
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};