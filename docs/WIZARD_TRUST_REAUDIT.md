# Wizard Trust Re-Audit

Date: 2026-03-16 14:35:44

Environment:
- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- Browser audit: local Playwright session against the running dev stack

Scope:
- Step 1 assisted lookup
- Step 2 importable-year previews
- Step 3 reviewed-versus-technical-ready truth
- Step 4 shared year-detail review/edit surface

Findings:
- Step 1 now supports assisted lookup instead of button-only search. Typing `Krono` surfaced `Kronoby vatten och avlopp ab` as a suggestion before connect, and the row was selectable without a separate manual search roundtrip.
- Step 2 now leads with recognizable business values. Importable years surfaced `Liikevaihto`, unit prices, and sold volumes before secondary dataset-count metadata.
- Step 3 no longer equates technical completeness with approval. Imported years were labeled `Teknisesti valmis`, `Tarkistetut vuodet` remained `0`, and the continuation hint explicitly required human review before baseline acceptance.
- Step 3 ready rows are now explicitly reviewable. Each technically ready year exposed `Avaa ja tarkista`.
- Step 4 is now one shared year-detail surface. Opening a technically ready year showed the same review/edit dialog used for year decisions, with financials, prices, and volumes first.
- Raw VEETI versus effective values are visible in the shared surface for financials, prices, and volumes.
- Section-level VEETI restore paths exist for financials, prices, and volumes.
- Secondary content is demoted behind lower-priority sections and collapsible detail, while primary review/edit work stays focused on canonical business values.

Outcome:
- whole sprint succeeded
