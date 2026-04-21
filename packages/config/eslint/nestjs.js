module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: [
    './base.js',
    'plugin:@typescript-eslint/recommended',
    'plugin:nestjs/recommended',
  ],
  plugins: ['nestjs', 'import'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRoot: './tsconfig.json',
    project: ['./tsconfig.json'],
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'import/no-cycle': ['error', { ignoreExternal: true, maxDepth: 1 }],
    'nestjs/use-validation-pipe': 'warn',
    'prefer-const': 'warn',
  },
  overrides: [
    {
      files: ['src/v2/v2-forecast.service.ts', 'src/v2/v2-import-overview.service.ts'],
      rules: {
        '@typescript-eslint/no-this-alias': 'off',
      },
    },
  ],
};
