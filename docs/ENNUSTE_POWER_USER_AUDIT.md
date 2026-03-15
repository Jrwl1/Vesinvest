# Ennuste Power-User Audit

Date: 2026-03-15

## Scope

- Verified the current Forecast cockpit after accepted rows `S-53..S-57`.
- Focused on statement-native comparison, drill-down continuity, depreciation mapping gates, and report-readiness truth.

## Local evidence

- `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx`
- `pnpm --filter ./apps/web typecheck`

## Findings

- The selected scenario opens into a compact statement cockpit with derived rows and five planning pillars before the detailed editors.
- `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and `Avskrivningar` all keep return-to-cockpit continuity.
- Report readiness stays blocked until depreciation mapping is complete, and it returns to ready after recompute.
- The outputs area now includes statement-native comparison surfaces for derived result rows and the five pillars, using the loaded base scenario as the comparison baseline.
- No blocker was found in the focused local regression path for cockpit -> drill-down -> save -> recompute -> report-readiness -> comparison.

## Limits

- This audit is based on focused local regression and direct UI/code inspection in the current workspace, not a separate live-browser walkthrough against a running full stack.

## Outcome

whole sprint succeeded
