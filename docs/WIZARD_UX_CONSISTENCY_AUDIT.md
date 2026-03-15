# Wizard UX Consistency Audit

Date: 2026-03-15
Auditor: Codex
Environment: local dev web `http://127.0.0.1:5173` + API `http://localhost:3000`
Org used: `Kronoby vatten och avlopp ab` (`0180030-9`)

## Audit scope

Fresh browser pass across:

1. Login and locked shell state
2. Overview step 1 search/connect
3. Overview step 2 import selection
4. Overview step 3 readiness review
5. Overview step 5 baseline creation
6. Overview step 6 handoff
7. Forecast first-run empty scenario state
8. Reports empty state before first report

## Findings

- Step 1 loaded with truthful shell state: header showed `Setup required`, no utility selected, and both `Ennuste` and `Raportit` stayed disabled.
- Step 1 placed the active search/connect form first and kept summary chrome secondary.
- Step 2 cleanly separated `Tuotavat vuodet` from `Korjaa ennen tuontia`; importable years were primary and repair-only years were clearly demoted.
- Step 2 summary language described imported workspace years, not every available VEETI year.
- Step 3 showed imported years in one focused readiness surface and moved directly to baseline creation because all imported years were ready.
- Step 5 kept the baseline action as the single primary CTA and summarized included/excluded/corrected years without reintroducing dashboard clutter.
- After baseline creation, shell state became truthful immediately: header switched to connected state and both `Ennuste` and `Raportit` unlocked.
- Step 6 offered one coherent next action path: `Avaa Ennuste` with no duplicate starter-scenario inputs on Overview.
- Forecast opened in a matching first-run state: empty scenario list, focused `Skenaarion nimi` field, and guidance that the first scenario is created there.
- Reports with zero reports acknowledged the empty state as expected, repeated the exact next action, and offered `Avaa Ennuste` as the continuation path.

## Notes

- Authentication used the local seeded trial account `admin@vesipolku.dev`.
- The audit also confirmed the post-setup route handoff by navigating Overview -> Forecast -> Reports -> Forecast in one live session with the same unlocked shell state.

whole sprint succeeded
