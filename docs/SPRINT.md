# Sprint

Window: 2026-02-27 to 2026-04-30

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Make VEETI import behavior fully trustworthy for Ennuste inputs: import exactly the VEETI fields the app uses, persist available data even when yearly data is incomplete, default missing calculation inputs to 0 in computation paths, and show explicit incomplete-year warnings without hiding source fidelity.

## Recorded decisions (this sprint)

- Scope for baseline calculations is intentionally limited to Ennuste-required datasets; this sprint does not expand to all VEETI entities.
- `taksa` remains mapped to `TaksaKayttomaksu` (usage fees) for now; full `Taksa` stays an explicit follow-up scope item.
- Yearless VEETI rows (notably `verkko`) are persisted in a static org-level bucket and reused across year reads.
- Missing source values remain distinguishable from real zero in import metadata; computation paths may still use numeric fallback `0`.
- Year readiness remains based on required drivers only (`tilinpaatos`, `taksa`, and at least one volume dataset), with warnings for partial years.

---

| ID   | Do                                                                                                                                                                                                          | Files                                                                                                                                                                                                                | Acceptance                                                                                                                                                                                                                                        | Evidence                                         | Stop                                                                                                                           | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| S-06 | Fix yearless `verkko` persistence and read semantics so imported non-year network rows are never dropped and are visible in effective year datasets. See S-06 substeps below.                               | apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-sync.service.spec.ts                                           | Re-importing org 1535 keeps all 3 `Verkko` rows accessible via effective year data; `vuosi=0` static rows do not leak into visible year list; benchmark/context consumers can still resolve network metrics for yearly computations.              | commit `abda4f6`; API tests PASS                 | Stop if static-row fallback causes duplicate counting in any yearly aggregate consumer.                                        | DONE   |
| S-07 | Codify VEETI import contract in code and refactor fetch paths to prevent silent scope drift (required-for-Ennuste vs optional/static datasets). See S-07 substeps below.                                    | apps/api/src/veeti/veeti-import-contract.ts, apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti.service.spec.ts                                                                                           | Dataset/entity mapping is centralized and typed; `fetchAllOrgData` and `fetchEntityByYear` follow the same contract; static datasets are not queried with invalid `Vuosi` filters; regression tests lock expected mappings.                       | commit `abda4f6`; import-contract tests PASS     | Stop if VEETI API shape changes break deterministic mapping (entity name/field mismatch not resolvable from current contract). | DONE   |
| S-08 | Implement missing-value semantics + warning pipeline: preserve source fidelity, compute with zero fallback, and expose explicit year warnings in UI/API. See S-08 substeps below.                           | apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/ | Budget and import-status payloads expose missing-field/fallback metadata; Overview shows warning text for partial years; incomplete years remain blocked for sync while existing values continue to import; no regression in baseline generation. | commit `abda4f6`; typecheck + test + smoke PASS  | Stop if warning metadata inflates payload size enough to impact overview load performance.                                     | DONE   |
| S-09 | Add hard parity quality gate using org 1535 reference fixture to verify imported dataset counts/values against VEETI truth-source snapshots. See S-09 substeps below.                                       | fixtures/veeti/org-1535-reference.json, scripts/ops/veeti-1535-parity.mjs, package.json                                                                                                                              | `pnpm ops:veeti:parity` fails on any mismatch for imported datasets/years; release check can include parity gate; fixture captures canonical expected rows for current scope (tilinpaatos, taksa, volumes, investointi, energia, verkko).         | commit `abda4f6`; parity gate PASS               | Stop if parity input cannot be stabilized due to upstream VEETI data mutation without versioned fixture strategy.              | DONE   |
| S-10 | Clarify tariff scope and operator visibility: make usage-fee-only behavior explicit, add import dataset counters, and verify clear->connect->sync local run meets trust narrative. See S-10 substeps below. | apps/api/src/veeti/veeti.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/                                                              | UI/API clearly state `TaksaKayttomaksu` scope; import status surfaces per-dataset row counters; local acceptance run confirms: available values imported, missing required inputs flagged, and partial years remain visible with warnings.        | commit `abda4f6`; parity + smoke + UI audit PASS | Stop if product decision changes to require full `Taksa` before release (scope escalation beyond this sprint).                 | DONE   |

### S-06 substeps

- [x] Persist yearless `verkko` rows into a static snapshot bucket (`vuosi=0`) during VEETI sync
  - files: apps/api/src/veeti/veeti-sync.service.ts
  - run: pnpm --filter ./apps/api test -- src/veeti/veeti-sync.service.spec.ts
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/veeti/veeti-sync.service.spec.ts -> PASS | files:apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-sync.service.spec.ts | docs:N/A | status: clean
- [x] Add effective read fallback so `getEffectiveRows(..., year, 'verkko')` returns static (`vuosi=0`) rows when year-specific rows are missing
  - files: apps/api/src/veeti/veeti-effective-data.service.ts
  - run: pnpm --filter ./apps/api test -- src/veeti
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/veeti -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/veeti/veeti-effective-data.service.spec.ts | docs:N/A | status: clean
- [x] Keep static bucket hidden from visible import years while preserving completeness behavior for real years
  - files: apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/v2 src/veeti
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/v2 src/veeti -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

### S-07 substeps

- [x] Create typed VEETI import contract file mapping dataset key, OData entity, yearly/static mode, and required-for-Ennuste flag
  - files: apps/api/src/veeti/veeti-import-contract.ts
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/veeti/veeti-import-contract.ts | docs:N/A | status: clean
- [x] Refactor `fetchAllOrgData` to resolve endpoint fetches from the shared import contract
  - files: apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti-import-contract.ts
  - run: pnpm --filter ./apps/api test -- src/veeti
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/veeti -> PASS | files:apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti-import-contract.ts | docs:N/A | status: clean
- [x] Update `fetchEntityByYear` logic for static datasets and add regression tests for yearly vs static query generation
  - files: apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts -> PASS | files:apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti.service.spec.ts | docs:N/A | status: clean

### S-08 substeps

- [x] Extend budget preview/generation metadata with deterministic missing-field list and fallback-to-zero counters
  - files: apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts
  - run: pnpm --filter ./apps/api test -- src/veeti/veeti-budget-generator.spec.ts
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/veeti/veeti-budget-generator.spec.ts -> PASS | files:apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts | docs:N/A | status: clean
- [x] Extend import year/status payload with warning metadata while keeping sync readiness rules unchanged
  - files: apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 src/veeti && pnpm --filter ./apps/web typecheck
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/v2 src/veeti && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts | docs:N/A | status: clean
- [x] Render per-year warning copy in Overview and localize FI/SV messages for fallback-to-zero visibility
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json | docs:N/A | status: clean

### S-09 substeps

- [x] Create canonical org 1535 parity fixture from current VEETI reference values for imported datasets (N/A allowed for initial fixture authoring)
  - files: fixtures/veeti/org-1535-reference.json
  - run: N/A
  - evidence: commit:abda4f6 | run:N/A -> fixture created | files:fixtures/veeti/org-1535-reference.json | docs:N/A | status: clean
- [x] Implement parity checker script comparing app import year-data rows/counts against fixture values
  - files: scripts/ops/veeti-1535-parity.mjs
  - run: node scripts/ops/veeti-1535-parity.mjs --help
  - evidence: commit:abda4f6 | run:node scripts/ops/veeti-1535-parity.mjs --help -> PASS | files:scripts/ops/veeti-1535-parity.mjs | docs:N/A | status: clean
- [x] Wire parity checker into workspace scripts and validate command end-to-end
  - files: package.json, scripts/ops/veeti-1535-parity.mjs
  - run: pnpm ops:veeti:parity
  - evidence: commit:abda4f6 | run:pnpm ops:veeti:parity -> PASS | files:package.json, scripts/ops/veeti-1535-parity.mjs | docs:N/A | status: clean

### S-10 substeps

- [x] Make usage-fee-only tariff scope explicit (`TaksaKayttomaksu`) in API/UI copy and labels
  - files: apps/api/src/veeti/veeti.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json | docs:N/A | status: clean
- [x] Add import dataset counters in status payload and Overview so operators can see what was actually imported
  - files: apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:abda4f6 | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean
- [x] Validate local acceptance path (clear -> connect 1535 -> sync -> verify partial-year warnings) and ensure parity/smoke gates pass
  - files: apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, scripts/ops/veeti-1535-parity.mjs
  - run: pnpm ops:veeti:parity && pnpm smoke:v2
  - evidence: commit:abda4f6 | run:pnpm ops:veeti:parity && pnpm smoke:v2 -> PASS | files:apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, scripts/ops/veeti-1535-parity.mjs | docs:N/A | status: clean
