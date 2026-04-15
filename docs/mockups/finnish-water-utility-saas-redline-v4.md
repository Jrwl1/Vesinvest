# Redline v4

This pass tightens the unified-system mockup into a more production-ready direction.

## Global changes

- Reduced decorative shell treatment.
  - Removed visible background grid and strong radial accents.
  - Flattened the shell bar into a precise, quieter frame.
- Shortened the step tracker labels.
  - Tracker now uses `Valitse`, `Vuodet`, `Tarkista`, `Pohja`, `Ennuste`.
  - Full step wording remains in the page title and support context.
- Kept one shared shell, one palette, one border language, one spacing rhythm, and one control family across all tabs.

## Step 1

- Support rail reduced to two compact panels.
  - `Tilanne`
  - `Seuraava vaihe`
- Utility search remains fast and transactional.
- No extra shell drama or onboarding chrome.

## Step 2

- Year inclusion is now explicit and operational.
  - Added a clear header toggle-like state: `Mukana`.
  - Replaced the earlier semantic mix of `Valittu` / `Pidä mukana` / `Pois suunnitelmasta`.
- Removed any decorative result-state chips that can drift away from the actual card numbers.
- Kept the year card as the main trust object.
- Support rail reduced to two panels.

## Step 3

- `Tulos` is now derived by default.
  - It is shown as `Tulos (laskettu)` in a derived block.
  - It is no longer presented as a normal peer input field.
- Action hierarchy is fixed.
  - Primary: `Tallenna ja hyväksy`
  - Secondary: `Tallenna`
  - Secondary: `Palauta VEETI-arvot`
  - Destructive secondary: `Pois suunnitelmasta`
- Support rail reduced to two panels.
- Expanded card still stays in place as the same object.

## Step 4–5

- Baseline checkpoint and forecast handoff remain inside the same material system.
- No fake success state.
- Step 5 is still procedural and launch-oriented.

## Ennuste

- Kept the same shell, same palette, same borders, same buttons, same chips.
- Removed the separate dark/analytics identity.
- Rebalanced the first viewport.
  - The chart zone now dominates.
  - One workbench card is clearly primary: `Poistosuunnitelmat`.
- Added a bit more accounting context to the chart header.
  - unit
  - scenario reference
  - freshness context

## Raportit

- Kept the same shell and control language.
- Reduced the preview’s mini-KPI feel.
- Rebuilt the right side into a metadata-first document definition surface.
  - selected report
  - freshness
  - scenario
  - baseline source
  - export format
  - created timestamp
  - included sections
  - excluded sections
- CTA hierarchy now favors reporting.
  - Primary: `Vie PDF`
  - Secondary: `Avaa Ennuste`

## Production intent

This is no longer a broad concept pass.
It is a direct tightening toward implementation:

- less ornamental shell chrome
- crisper action hierarchy
- stricter accounting semantics
- less duplicated side information
- more disciplined continuity across tabs
