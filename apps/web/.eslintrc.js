module.exports = {
  extends: ['@packages/config/eslint/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  }
};