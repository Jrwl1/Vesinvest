# CFO End-to-End Audit 2026-03-19

Date: 2026-03-19
Environment: local dev site at `http://localhost:5173`
Account used: `admin@vesipolku.dev` / `admin123`
Organization: `Kronoby vatten och avlopp ab`

## Scope

Fresh reset -> connect -> import -> review -> baseline -> forecast -> report -> PDF.

## Live path

1. Reset the org from the account drawer using confirmation code `C9032CDE`.
2. Searched for `kronoby`, connected `Kronoby vatten och avlopp ab`, and imported `2024`, `2023`, and `2022`.
3. Completed the three imported years manually in step 3 by filling the missing `Material och tjänster` row so the visible result equation stayed consistent:
   - `2024`: `69 167 EUR`
   - `2023`: `24 360 EUR`
   - `2022`: `10 525 EUR`
4. Verified the wizard advanced with `3/3` ready years and unlocked the step-6 Forecast handoff.
5. Opened Forecast, created scenario `CFO audit scenario`, and added three future investments in the start-of-Ennuste `Investeringsprogram` surface:
   - `2024` network replacement: `100 000 EUR`
   - `2025` plant new investment: `150 000 EUR`
   - `2026` meters replacement: `40 000 EUR`
6. Saved and computed results, opened `Poistosaannot`, and confirmed the explicit default suggestions:
   - `2024`: `Vattendistributionsnät från 1999`
   - `2025`: `Maskiner och anordningar vid vatten- och avloppsverk`
   - `2026`: `ADB-utrustning`
7. Saved the depreciation mappings, recomputed again, then created the report successfully.
8. Landed on Reports with the newly created report selected and confirmed the saved snapshot, variant, and export state.

## Audit blockers found and fixed during this run

1. After saving depreciation mappings, Forecast still showed report status as ready even though `Create report` returned `409 Conflict`.
   Fix applied during this packet: depreciation rule saves, deletes, and class-allocation saves now invalidate the compute token so the page truthfully returns to `saved_needs_recompute` until the user recomputes.

2. The first-scenario handoff card could show the wrong baseline year from `planningContext.baselineYears[0]`.
   Fix applied during this packet: the handoff card now uses the latest baseline year rather than the first array entry.

3. The Forecast long-range investment editor reused `yearly-investment-*` ids across grouped blocks and the full annual table, and the depreciation workbench fields lacked id/name-safe coverage for live audit expectations.
   Fix applied earlier in this sprint tail: removed the dead duplicate branch and added rendered-DOM guards for unique ids in Forecast and Reports tests.

## Evidence

- Forecast report status before saving mappings: blocked for incomplete depreciation mapping.
- Forecast report status after saving mappings: blocked again until recompute, as expected after the fix.
- Forecast report status after recompute: ready.
- Reports page loaded with selected report title:
  `Ennusteraportti CFO audit scenario 19.3.2026`
- Final network results:
  - `POST /api/v2/reports` -> `201`
  - `GET /api/v2/reports/:id` -> `200`
  - `GET /api/v2/reports/:id/pdf` -> `200`
- Final current-page browser console on the Reports page: clean.

## Verdict

The CFO path is usable end to end on the dev site after the fixes in this packet.

whole sprint succeeded
