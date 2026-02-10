# Backlog

Unordered V1 work pool. `docs/SPRINT.md` can contain max 5 active items pulled from this list.

## Epic E1: Customer contract and data requirements lock

- B-101: Confirm signed V1 scope in/out with customer.
- B-102: Confirm authoritative mapping source for "KVA bokslutets struktur" per year.
- B-103: Confirm VAT and tariff model details for water/wastewater.
- B-104: Confirm whether connection metrics/fees are required in V1.
- B-105: Confirm required investment horizon (full 20 years vs phased rollout).

## Epic E2: Functional parity to customer V1 must-haves

- B-201: Map current code capabilities to each approved acceptance criterion.
- B-202: Define and validate import constraints for accepted KVA/PTS input variants.
- B-203: Confirm required planning outputs for pilot (screen, CSV, PDF, regulatory).
- B-204: Run pilot-data acceptance check and capture evidence.

## Epic E3: Security readiness

- B-301: Enforce production config baseline (no demo/dev bypass, strict CORS, strong JWT secret policy).
- B-302: Define login/auth abuse protections and release checks.
- B-303: Define tenant isolation regression checks for org-scoped access.
- B-304: Define secret management and rotation process per customer tenant.

## Epic E4: Release and operations (Render single-tenant)

- B-401: Define app+DB-per-customer deployment runbook.
- B-402: Define backup/restore procedure and migration policy.
- B-403: Define observability baseline (health, logs, Sentry instrumentation plan).
- B-404: Define CI checks and manual promotion gates.

## Epic E5: Test and acceptance gates

- B-501: Define Playwright smoke flow for release gate (no implementation in this pass).
- B-502: Define Given/When/Then acceptance checklist for customer signoff.
- B-503: Define release evidence package for each pilot go-live.
- B-504: Define rollback drill checklist and ownership responsibilities.

## Done

- None in this planning cycle yet.
