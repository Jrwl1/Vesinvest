# Architecture Index

Use this map before reading implementation files. It points agents to current architecture, enforced boundaries, and runtime contracts.

## System Overview

- Existing architecture summary: `../ARCHITECTURE.md`
- API surface summary: `../API.md`
- Boundary rules: `boundaries.md`

## Code Areas

- Web app: `../../apps/web/src/`
- API app: `../../apps/api/src/`
- Prisma schema and migrations: `../../apps/api/prisma/`
- Shared domain package: `../../packages/domain/src/`
- Shared config package: `../../packages/config/`

## Mechanical Enforcement

- Dependency boundaries: `../../.dependency-cruiser.cjs`
- Boundary check wrapper: `../../scripts/check-boundaries.mjs`
- File caps and facade limits: `../../scripts/check-file-caps.mjs`, `../../scripts/check-thin-facades.mjs`
- Text integrity: `../../scripts/check-text-integrity.mjs`

