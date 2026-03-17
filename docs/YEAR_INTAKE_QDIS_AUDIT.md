# Year Intake QDIS Audit

Date: 2026-03-17

## Automated regressions

- PASS: `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/qdisPdfImport.test.ts src/i18n/locales/localeIntegrity.test.ts`
- PASS: `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts`
- PASS: `pnpm --filter ./apps/web typecheck`
- PASS: `pnpm --filter ./apps/api typecheck`

## Live audit pre-check

- Required audit input: the real 2022 customer QDIS export PDF.
- Search run across `C:\Users\john` for likely filenames containing `qdis`, `kronoby`, `terjarv`, `vatten`, `avlopp`, `export`, or `2022`.
- Found PDFs:
  - `C:\Users\john\Downloads\Ab Terjärv Vatten och Avlopp_Budget 2026.pdf`
  - `C:\Users\john\Downloads\Kronoby Vatten och Avlopp Ab_Budget 2026.pdf`
  - `C:\Users\john\Plan20\saas-monorepo\fixtures\Ab Terjärv Vatten och Avlopp_Budget 2026.pdf`
  - `C:\Users\john\Plan20\saas-monorepo\fixtures\Kronoby Vatten och Avlopp Ab_Budget 2026.pdf`
- None of the discovered PDFs is the requested real 2022 customer QDIS export.

## Outcome

blocker: real 2022 customer QDIS export PDF not found locally; wiped-workspace live audit could not be executed.
