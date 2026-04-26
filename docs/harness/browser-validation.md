# Browser Validation Harness

Use browser validation when a task changes routes, layout, user workflows, or runtime state that unit tests cannot fully prove.

## Current Tools

- Playwright tests: `../../e2e/`
- Full V2 flow: `../../e2e/v2.full-flow.spec.ts`
- Browser artifacts: ignored `output/`, `test-results/`, and `playwright-report/`

## Journey Evidence

For browser-facing changes, capture the narrowest useful evidence:

- route and viewport
- before/after screenshot when visual behavior changed
- console errors
- failed network requests
- selected DOM state or accessible text for the touched surface

## Named Journeys To Keep Legible

- demo login
- Overview import and review
- `Yhteenveto` verification
- Forecast entry
- `Poistosuunnitelmat`
- Investment entry
- Reports handoff and export

