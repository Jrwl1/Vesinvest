# Excel Override And Investment Audit

Date: 2026-03-18
Environment: local `http://localhost:5173` + `http://localhost:3000`
Account: `admin@vesipolku.dev`

## Scope

Audit the wiped-workspace Kronoby flow for:

1. workspace wipe
2. VEETI reconnect and year import
3. workbook compare/apply for historical repair
4. explicit 2024 statement-PDF + workbook mixed-source merge
5. entry into `Investointiohjelma`

## Audit Trail

1. Wiped the Kronoby workspace from the account drawer using confirmation code `C9032CDE`.
2. Reconnected Kronoby (`0180030-9`) and re-imported years `2022`, `2023`, and `2024`.
3. Uploaded [`fixtures/Simulering av kommande lönsamhet KVA.xlsx`](/C:/Users/john/Plan20/saas-monorepo/fixtures/Simulering%20av%20kommande%20l%C3%B6nsamhet%20KVA.xlsx) from the `2024` year review card.
4. Applied the workbook choices and synced the repaired years.
5. Created the planning baseline and opened `Prognos`, where the new `Investointiohjelma` start surface and `Poistosaannot` handoff were visible.

## Verified

- workspace wipe worked
- reconnect and import worked
- workbook compare/apply worked
- baseline creation worked
- entry into `Investointiohjelma` worked

## Blocker

The live run did not prove the explicit 2024 statement-PDF + workbook mixed-source path.

Observed behavior:

- after workbook repair + sync, the workflow advanced cleanly into the baseline and Forecast handoff
- in Forecast, the baseline source truth for 2024 economics showed workbook import, not an explicit statement-PDF + workbook mixed ownership state
- this audit did not validate a same-session user path that visibly preserved statement-backed finance rows together with workbook-backed repair rows before baseline creation

Because the row explicitly requires a live audit that covers the 2024 statement merge, this audit stops here.

## Outcome

blocker: 2024 statement merge remained unproven in the live flow; sprint stop at `S-106`
