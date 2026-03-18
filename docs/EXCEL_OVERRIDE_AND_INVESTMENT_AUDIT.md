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

### Pass 1: full wipe and workbook repair

1. Wiped the Kronoby workspace from the account drawer using confirmation code `C9032CDE`.
2. Reconnected Kronoby (`0180030-9`) and re-imported years `2022`, `2023`, and `2024`.
3. Uploaded [`fixtures/Simulering av kommande lönsamhet KVA.xlsx`](/C:/Users/john/Plan20/saas-monorepo/fixtures/Simulering%20av%20kommande%20l%C3%B6nsamhet%20KVA.xlsx) from the `2024` year review card.
4. Applied the workbook choices and synced the repaired years.
5. Created the planning baseline and opened `Prognos`, where `Investointiohjelma` and the `Poistosaannot` handoff were visible.

This pass exposed the workflow gap that statement import on `2024` advanced too quickly to continue with workbook repair on the same year.

### Pass 2: fixed live 2024 statement + workbook merge

1. Applied the fix that keeps `2024` in step-3 review after `statement import + sync`.
2. Wiped the workspace again.
3. Reconnected Kronoby and imported `2024`.
4. Imported [`docs/client/Bokslut reviderad 2024.pdf`](/C:/Users/john/Plan20/saas-monorepo/docs/client/Bokslut%20reviderad%202024.pdf) from the `2024` review surface and confirmed/synced it.
5. Verified that the same `2024` review stayed open and still exposed `Importera KVA-arbetsbok`.
6. Uploaded [`fixtures/Simulering av kommande lönsamhet KVA.xlsx`](/C:/Users/john/Plan20/saas-monorepo/fixtures/Simulering%20av%20kommande%20l%C3%B6nsamhet%20KVA.xlsx), applied the workbook repair for the missing `Material och tjänster` line, and synced the year.
7. Created the planning baseline and opened `Prognos`.
8. Verified that `Basårets källsanning` showed `Bokslut PDF + arbetsbokskorrigering` for the `Ekonomi` source on `2024`.

## Verified

- workspace wipe worked
- reconnect and import worked
- workbook compare/apply worked
- 2024 statement PDF import worked
- the same 2024 year stayed in review long enough to continue with workbook repair
- Forecast baseline source truth showed the explicit mixed source label `Bokslut PDF + arbetsbokskorrigering`
- baseline creation worked
- entry into `Investointiohjelma` worked

## Outcome

whole sprint succeeded
