# Testing Guide

This document covers how to run tests in the monorepo.

## Quick Start

```bash
# Run all workspace tests
pnpm -r test

# Run API tests only
pnpm --filter ./apps/api test
```

## API Tests (Jest)

The API (`apps/api`) uses Jest with ts-jest for TypeScript support.

### Basic Commands

```bash
# Run all API tests
pnpm --filter ./apps/api test

# Run from within apps/api directory
cd apps/api
pnpm test
```

### Passing Jest Flags

To pass flags like `--runInBand` (run tests serially), `--watch`, or `--coverage`:

```bash
# Using pnpm exec (recommended for CI/scripts)
pnpm --filter ./apps/api exec jest --runInBand

# Using -- separator
pnpm --filter ./apps/api test -- --runInBand

# Run specific test file
pnpm --filter ./apps/api exec jest src/imports/row-hash.spec.ts

# Watch mode
pnpm --filter ./apps/api exec jest --watch

# With coverage
pnpm --filter ./apps/api exec jest --coverage
```

### Test Files Location

API tests are co-located with source files:
- `apps/api/src/**/*.spec.ts` - Unit tests
- `apps/api/test/**/*.spec.ts` - E2E tests

### Current Test Suites

| File | Description |
|------|-------------|
| `src/mappings/canonical-registry.spec.ts` | Canonical field registry validation |
| `src/imports/row-hash.spec.ts` | Row hash computation for idempotency |
| `src/imports/column-profiler.spec.ts` | Excel column type inference |

## Web Tests

The web app (`apps/web`) does not have tests configured yet. The test script is a no-op placeholder.

To add tests later, install Vitest:
```bash
pnpm --filter ./apps/web add -D vitest @testing-library/react
```

## CI/CD

For CI pipelines, run tests with `--runInBand` to avoid parallel execution issues:

```bash
pnpm --filter ./apps/api exec jest --runInBand --ci
```

## Configuration Notes

### ts-jest Version Warning Suppression

The API uses ts-jest 27.x with TypeScript 5.x. ts-jest emits a version compatibility warning because it predates TS 5.x, but it works correctly for our use case. The warning is suppressed via `TS_JEST_DISABLE_VER_CHECKER=1` in `apps/api/jest.config.js`.

See: https://github.com/kulshekhar/ts-jest/issues/4198

## Troubleshooting

### "Cannot use import statement outside a module"
Ensure `jest.config.js` exists in `apps/api` with `preset: 'ts-jest'`.

### Prisma types not found
Regenerate the Prisma client:
```bash
pnpm --filter ./apps/api exec prisma generate
```

### Tests timing out
Run with `--runInBand` to execute tests serially:
```bash
pnpm --filter ./apps/api exec jest --runInBand
```
