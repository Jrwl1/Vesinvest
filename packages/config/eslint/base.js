const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['import'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: [
          path.join(repoRoot, 'apps/web/tsconfig.json'),
          path.join(repoRoot, 'apps/api/tsconfig.json'),
          path.join(repoRoot, 'packages/domain/tsconfig.json'),
        ],
      },
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/no-cycle': ['error', { ignoreExternal: true, maxDepth: 1 }],
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      excludedFiles: [
        'src/**/*.{test,spec}.{ts,tsx,js,jsx}',
        'src/**/test-support/**/*.{ts,tsx,js,jsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/test-support/**'],
                message:
                  'Production code must not import test-support modules.',
              },
            ],
          },
        ],
      },
    },
  ],
};
