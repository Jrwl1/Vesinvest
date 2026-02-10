# Sprint (next 12 weeks)

Window: 2026-02-10 to 2026-05-05

Exactly 5 executable DO items. Execute top-to-bottom.

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Remove VAT from all V1 calculation paths and produce VAT-free budget/projection outputs. | `apps/api/src/projections/**`, `apps/api/src/budgets/**`, `apps/web/src/pages/**`, related tests | No VAT value is used in V1 calculations; outputs remain VAT-free. | Test output + changed file paths in commit. | Stop if any required VAT use is mandated by a signed customer requirement; add blocker + `B-TBD` in backlog. | TODO |
| S-02 | Build annual base-fee handling as yearly total plus yearly percent change/override. | `apps/api/src/budgets/**`, `apps/api/src/projections/**`, `apps/web/src/pages/BudgetPage*`, related tests | Base fee can be set annually and adjusted yearly; behavior matches ADR-013. | UI/API evidence + tests + commit hash. | Stop if change requires new tariff-table scope; log blocker and stop. | TODO |
| S-03 | Output depreciation as two explicit components: baseline and investment-driven additional depreciation. | `apps/api/src/projections/**`, `apps/web/src/pages/ProjectionPage*`, export/report files, related tests | Projection outputs show both depreciation components separately and consistently. | Snapshot/report sample + tests + commit hash. | Stop if split cannot be represented without schema change not approved in sprint scope. | TODO |
| S-04 | Generate the V1 PDF cashflow report with diagram and compact table, allowing multi-page layout. | `apps/api/src/projections/**`, export utilities, `apps/web/src/pages/ProjectionPage*`, related tests | PDF answers pricing coverage question and follows approved format rules. | Generated PDF artifact + acceptance checklist + commit hash. | Stop if requested output exceeds locked V1 scope; log as backlog item. | TODO |
| S-05 | Enforce hosted single-tenant release gates with build-time checks and final pre-release security audit checks. | CI/deploy docs and configs, `docs/DEPLOYMENT.md`, relevant pipeline files | Release gate checklist is executable and blocks release when unmet. | Gate run evidence + checklist + commit hash. | Stop if platform prerequisites are missing; add blocker with owner. | TODO |
