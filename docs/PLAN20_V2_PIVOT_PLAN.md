# Vesipolku v2.0 - Effective Year Data Plan

Date: 2026-03-06
Status: ACTIVE
Owner: John

## 1. Product direction

Vesipolku is not a VEETI-only importer anymore.

The product direction is:

- Use VEETI as the default seed and external comparator.
- Let the utility correct bad historical years with statement-backed manual capture.
- Build forecast scenarios and reports from effective year data, not from raw VEETI alone.

This change is driven by repo reality and customer fit:

- Small utilities often have incomplete or wrong VEETI financial history.
- The current V2 app already contains year-level trust handling, manual completion, and source-state reporting.
- Forecast and reporting value depends on a trusted baseline, not on VEETI purity.

## 2. Repo-grounded current state

The current V2 application already has the right product skeleton:

- Overview / import governance in `apps/web/src/v2/OverviewPageV2.tsx`
- Forecast / scenarios in `apps/web/src/v2/EnnustePageV2.tsx`
- Reports / PDF outputs in `apps/web/src/v2/ReportsPageV2.tsx`
- V2 orchestration API in `apps/api/src/v2/v2.controller.ts` and `apps/api/src/v2/v2.service.ts`
- VEETI snapshot, override, and year-policy trust logic in `apps/api/src/veeti/veeti-effective-data.service.ts`

The trust model already exists in code:

- `VEETI | MANUAL | MIXED | INCOMPLETE` source states
- Manual year completion for admins
- Year delete / restore policy controls
- Effective rows computed from raw snapshot plus overrides

The main remaining mismatch is semantic:

- Product docs still describe VEETI as the single source of truth.
- Forecast copy and guardrails still talk about "VEETI baseline" instead of "effective baseline".
- Wrong-but-complete VEETI years are still treated too much like an exception path.

## 3. Product decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Source of truth | Effective year data | Forecast trust matters more than VEETI purity |
| Default source | VEETI first | Lowest-friction onboarding and benchmarking |
| Override path | Statement-backed manual capture | Reliable for small utilities with bad VEETI history |
| Evidence in this phase | Reason + statement reference text | Enough to ship without building PDF ingestion/export work now |
| Wrong VEETI years | First-class supported case | Target customer often has complete but incorrect data |
| Forecast dependency | Use effective baseline year, not VEETI-only baseline | Removes current product bottleneck |
| Benchmarking | Keep VEETI-based peer comparison | Still a strong differentiator |
| Planning model | Review each year and choose trust path | Better mental model than "fix missing VEETI" |

## 4. Non-goals for this phase

Not in the current phase:

- Generic PDF extraction or OCR
- PDF upload / storage as a required part of year correction
- Replacing the forecast math engine
- Rebuilding reports from scratch
- Eliminating VEETI from the product

PDF-backed evidence can be revisited later if customers actually need document storage inside the app.

## 5. Target user flow

The intended V2 flow should become:

1. Connect the organization to VEETI.
2. Import candidate years from VEETI.
3. Review each imported year.
4. For each year, choose the effective truth path:
   - keep VEETI
   - correct values from approved statement
   - manually complete missing data
5. Sync trusted years into baseline budgets.
6. Create forecast scenarios from the effective baseline.
7. Generate reports that explain results from effective data, with visible provenance.

This is a better fit for small utilities than the current implicit flow:

- connect VEETI
- hope years are good enough
- patch only when blocked

## 6. Implementation phases

### Phase 1 - Reframe V2 around effective year data

Goal:
Make the product language and API contract match what the system already does.

Changes:

- Replace VEETI-only product copy with effective-data language in V2 UI and docs.
- Rename user-facing concepts from "VEETI baseline" to "effective baseline year" where appropriate.
- Extend manual year completion to explicitly support statement-backed capture with:
  - source type
  - source reference text
  - reason
- Treat wrong-but-complete years as a normal review path, not only a blocked-year rescue path.

Primary files:

- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/sv.json`
- `apps/web/src/api.ts`
- `apps/api/src/v2/dto/manual-year-completion.dto.ts`
- `apps/api/src/v2/v2.service.ts`
- `apps/api/src/veeti/veeti-effective-data.service.ts`

Acceptance:

- Overview no longer frames VEETI as the only trusted path.
- A year can be corrected even when VEETI data is complete but wrong.
- Manual overrides carry source metadata that is visible in the year table and returned by the API.

### Phase 2 - Add year review and compare workflow

Goal:
Turn the Overview page into a review surface, not just an import stepper.

Changes:

- Add clearer per-year actions:
  - use VEETI values
  - edit effective values
  - save statement-backed correction
  - re-apply VEETI
- Show concise VEETI vs effective delta for key financial fields.
- Add source badges such as:
  - VEETI
  - Statement-backed
  - Manual
  - Mixed
  - Incomplete

Primary files:

- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/v2/v2.css`
- `apps/api/src/v2/v2.service.ts`

Acceptance:

- Users can review a year without reading raw dataset internals.
- Users can understand why a year is trusted or not trusted.
- Wrong-year correction is a first-class path in the main year list.

### Phase 3 - Decouple forecast from VEETI-only baseline semantics

Goal:
Allow forecasting from trusted effective data, regardless of whether that truth came from VEETI or manual correction.

Changes:

- Remove VEETI-only wording and guards where scenario creation only needs an effective baseline budget.
- Update forecast empty states and blocking messages.
- Ensure planning context and scenario creation reflect effective baseline semantics.

Primary files:

- `apps/web/src/v2/EnnustePageV2.tsx`
- `apps/web/src/i18n/locales/*.json`
- `apps/api/src/v2/v2.service.ts`

Acceptance:

- Scenario creation is explained in terms of trusted baseline availability, not VEETI purity.
- Forecast pages do not imply that statement-backed years are second-class.

### Phase 4 - Make reports reflect provenance

Goal:
Reports should reinforce trust, not hide the source path.

Changes:

- Update report wording to reflect effective year data.
- Surface baseline-source summary in report metadata and report detail view.
- Keep existing PDF export flow, but make its content truthful to the source model.

Primary files:

- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/api/src/v2/v2.service.ts`
- `apps/api/src/projections/*` if report payload needs source summary fields

Acceptance:

- Report text no longer implies that all results come directly from VEETI.
- Users can explain whether a baseline year is VEETI-derived, statement-backed, or mixed.

### Phase 5 - Optional later evidence storage

Goal:
Only revisit document upload if customers truly need in-app storage of approved statements.

Possible later work:

- File upload endpoint
- Object storage-backed document metadata
- Optional document link in source metadata
- Per-field page references

This phase is explicitly deferred.

## 7. Recommended sequencing

Recommended order:

1. Phase 1 first
2. Then Phase 2
3. Then Phase 3
4. Then Phase 4
5. Only later consider Phase 5

Reason:

- Phase 1 fixes the product language and truth model.
- Phase 2 makes that truth model usable.
- Phase 3 unlocks the core business value in forecasting.
- Phase 4 aligns outputs with the new trust model.
- Phase 5 is optional and should be driven by customer demand, not by implementation curiosity.

## 8. Open questions

These are the only questions worth resolving before implementation gets too deep:

1. Should statement-backed correction stay admin-only, or should the default customer account effectively always have that permission?
2. Is a free-text source reference enough for v1 of this flow, or do you want a stricter format such as "document + page"?
3. Do you want users to be able to override any dataset type per year, or should the first phase focus only on:
   - financial statement values
   - prices
   - sold volumes

Reasonable default if no further answer is given:

- keep admin-only in code, but assume the main customer operator is an admin
- use free-text source reference
- cover financials, prices, and volumes first; keep investments / energy / network optional

## 9. Success criteria

This direction is successful when:

- A small utility with bad VEETI history can still produce a trusted baseline.
- The Overview page explains year trust clearly.
- Forecast scenario creation no longer depends on VEETI-only semantics.
- Reports are explainable and audit-friendly.
- Repo docs describe the real product, not the superseded VEETI-only thesis.
