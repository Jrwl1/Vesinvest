module.exports = {
  extends: ['../../packages/config/eslint/nestjs.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  }
};