# Wizard Accounting Card Re-audit

Date: 2026-03-16

Scope:
- Fresh local browser audit from `Tili -> Tyhjennä tietokanta`
- Reconnect `Kronoby vatten och avlopp ab`
- Re-run step 2 import selection and step 3 review against the revised accounting-first cards
- Confirm the import/review flow still reads like setup, not a mini-Forecast workspace

Runtime used for this audit:
- API already reachable at `http://127.0.0.1:3000/health`
- Web already reachable at `http://127.0.0.1:5173`
- Local database was reset from the in-app `Tili -> Tyhjennä tietokanta` flow before the audit

Live audit result:
- `Tili -> Tyhjennä tietokanta` returned the workspace to `Vaihe 1 / 6`.
- Step 1 reconnect worked for `Kronoby vatten och avlopp ab`.
- Step 2 import cards now lead with `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and visible `Tulos`.
- Step 2 no longer labels technically importable years as `Valmis`; the card uses technical import wording instead.
- Prices, volumes, and source row counts remain available, but they are clearly secondary to the accounting rows.
- Step 3 review cards keep the same accounting-first structure as step 2 before any deeper review action.
- Step 3 helper copy stays factual and does not add inferred correctness language.
- Opening `Avaa ja tarkista` still lands in a review-first decision surface, with editing and secondary tools behind explicit actions instead of turning the wizard into a Forecast workbench.

Outcome:
- whole sprint succeeded
