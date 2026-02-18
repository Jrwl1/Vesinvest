# Ennuste UX Flow Plan — Simple structure, less text

**Context:** Current Ennuste page feels "all over the place"; user wants an intuitive flow so they know **where to put in what**, less text overflow, and a modern overhaul. Target users: Finnish water utilities (FI/SV/EN; no CAPEX/OPEX). Reference screenshot: current state with imported Excel.

**Goal:** One clear mental model: **1) Choose scenario → 2) Edit assumptions & drivers in one place → 3) Compute → 4) See results in one place.**

---

## 1. Current problems (from screenshot and feedback)

- **Inputs and outputs mixed:** KPIs, chart, assumptions, dropdowns (Olettamukset, Investeringar, Tuloajuriden suunnittelu, Aikajänne), year selector, and "Valittu vuosi" summary are scattered. User cannot quickly answer "where do I change X?"
- **Text overflow:** Long descriptive block ("Vaihtoehtoinen what-if skenaario. Perusskenaario on aktiivinen. Luo skenaario ja testaa..."), chart subtitle, three driver bullets, and multiple section labels add noise.
- **Redundant entry points:** "Luo skenaario" appears in header and again below chart; export buttons at top and in chart area; "Näytä taulukko" and "Näytä tulonjako" and tabs (Muuttujat / Tulokset / Tulonjako) and sub-tabs (Taulukko / Diagrammi) create too many paths.
- **No clear hierarchy:** Everything has similar visual weight (cards, dropdowns, buttons), so the flow "edit → compute → read" is not obvious.

---

## 2. Proposed UX flow (simplest structure)

### Mental model

| Step | User action | Where it lives |
|------|-------------|----------------|
| 1 | Pick or create scenario | Single row: scenario pills + "Luo skenaario" + delete. No paragraph. |
| 2 | Set assumptions & drivers | **One panel:** "Syötä olettamukset" (or "Antaganden") with: horizon, volume change %, cost change %, investments (list), **and** Tuloajurit (driver planner) in one scroll. One "Laske uudelleen" button. No nested tabs for "Olettamukset / Investeringar / Tuloajuriden suunnittelu" — either one accordion or one vertical list of sections. |
| 3 | Compute | One primary button: "Laske uudelleen". Last computed timestamp small, one line. |
| 4 | Read results | **One results zone:** (A) KPIs (sustainability, required tariff, cumulative result, deficit years) + year selector. (B) Main chart (tariff €/m³). (C) Selected-year summary (Tulot, Kulut, Poistot, Investoinnit, Tulos) in one row. (D) Short "Miksi tulos näyttää tältä?" — 3 bullets, one line each, no jargon. (E) Collapsible table + optional revenue breakdown; hide tabs "Muuttujat / Tulokset / Tulonjako" and fold "Muuttujat" into the single assumptions panel so the main view is "results" only after compute. |

### Layout (single scroll, two clear zones)

```
[ Ennuste ]                    [ Vie CSV ] [ Vie PDF ] [ Jämför ]

[ Perusskenaario 2025 * ] [ Luo skenaario ] [ × Poista ]

┌─────────────────────────────────────────────────────────────────┐
│  SYÖTÄ (edit only)                                               │
│  Horisontti: [20 v]   Volym: [-1 %]   Kulut: [+2,5 %]            │
│  Investoinnit: [lista]                                           │
│  Tuloajurit: [kompakt grid tai accordion]                        │
│  [ Laske uudelleen ]   Viimeksi: 17.2.2026 14:56                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TULOKSET (read only, after compute)                             │
│  Kestävä | Tarvittava tariffi 1,24 €/m³ | Kumul. 603 058 € | …  │
│  Valitse vuosi: [2025 ▼]                                         │
│  [ Tariffikaavio ]                                                │
│  2025: Tulot 820 973 € | Kulut 797 320 € | Poistot … | Tulos …   │
│  Miksi: 1. Volyymi … 2. Kulut … 3. Investoinnit ja poistot …     │
│  ▸ Näytä taulukko    ▸ Näytä tulonjako                           │
└─────────────────────────────────────────────────────────────────┘
```

- **Remove:** Long "Vaihtoehtoinen what-if" paragraph; duplicate "Luo skenaario" link; top-level tabs Muuttujat / Tulokset / Tulonjako (merge Muuttujat into "Syötä" and make the default view Tulokset).
- **Shorten:** "Miksi tulos näyttää tältä?" to three one-line bullets; chart subtitle to one short line or tooltip only.
- **Single place to edit:** All inputs (horizon, assumptions, investments, driver planner) in one "Syötä" panel. Single place to read: "Tulokset" panel.

---

## 3. What we can do more with Vite (and the stack)

- **Code-splitting / lazy routes:** Ennuste (and Talousarvio, Asetukset) as lazy-loaded route chunks so the initial bundle is smaller and the app feels snappier. Today tabs are in one bundle.
- **Component splitting:** ProjectionPage is ~1500 lines. Vite + React allow splitting into smaller components (e.g. EnnusteInputPanel, EnnusteResultPanel, EnnusteChart) with clear boundaries; easier to refactor UX and avoid "all over the place" in code as well.
- **Modern CSS:** Use CSS cascade layers or scoped Ennuste styles (e.g. `@layer ennuste`) and container queries so the Ennuste block can adapt layout (e.g. stack "Syötä" above "Tulokset" on narrow screens) without polluting global App.css.
- **State and URL:** Use URL search params or a simple router (e.g. `?tab=ennuste&scenario=xyz`) so "Ennuste" is shareable and back/forward work. Today tab state is in React state only.
- **Tooling:** Vite already gives fast HMR; we can add a design token file (e.g. `ennuste-tokens.css`) and import it only in the Ennuste layout for a consistent, modern look without touching the rest of the app.
- **Accessibility and performance:** React 18 + Vite support concurrent features; we can wrap the heavy compute in `useDeferredValue` or a small worker so the UI stays responsive. For a11y, a single "Syötä / Tulokset" structure improves focus order and screen-reader flow.

So: **yes, we can do more with Vite** — better structure (lazy routes, split components), clearer UX (one input zone, one result zone), less global CSS (scoped/layered), and optional URL state and design tokens. The current "all over the place" is fixable with a strict two-zone layout and removing redundant text and tabs.

---

## 4. Open for Codex

- Review this flow and suggest: (1) any step missing or wrong order, (2) whether "Syötä" should be accordion vs single scroll vs stepper, (3) how to fold the existing Muuttujat/Tulokset/Tulonjako tabs into this (e.g. remove Muuttujat tab and put its content in Syötä; default tab = Tulokset).
- Add a short "Codex UX recommendations" section to this doc.
- Answer: any other Vite/React improvements that would directly support this simpler Ennuste UX?

## Codex UX recommendations

- Add one explicit pre-step before editing: "Valitse skenaario + pohjadata" (import/source lock) so users know what dataset they are modifying.
- Keep flow order as: Scenario -> Inputs -> Compute -> Results -> Optional deep dive (table/revenue), and gate deep dive behind collapsibles.
- Keep "Laske uudelleen" disabled until input changes exist; show inline dirty marker and computed timestamp.
- Prefer `accordion` for "Syötä" sections over stepper or long single scroll.
- Reason: sections are revisited non-linearly (users jump between Olettamukset, Investoinnit, Tuloajurit), which stepper fights.
- Reason: accordion reduces visual overload while preserving one-page context and one compute action.
- Use default-open first section + auto-open section containing validation errors.
- Keep a compact sticky mini-summary at top of Syötä: Horisontti, Volyymi %, Kulut %, Investoinnit count.
- Do not compute on every keystroke; keep explicit compute for trust and performance predictability.
- Fold top-level tabs into two zones by capability mapping:
- `Muuttujat` -> move all editable controls into `Syötä` accordion sections.
- `Tulokset` -> becomes the always-visible `Tulokset` zone after first compute.
- `Tulonjako` -> convert to collapsible card inside `Tulokset` ("Näytä tulonjako"), closed by default.
- Replace old tabs with in-page anchors/chips: "Syötä" and "Tulokset" only; default landing focus on Tulokset if computed exists, else Syötä.
- Keep one chart mode by default; move alternate views to lightweight toggles inside Tulokset, not global navigation.
- Preserve capability parity by migrating each existing tab action into explicit cards/actions in one of the two zones; no hidden losses.
- Add per-section "Palauta oletus" (reset) and one global "Palauta kaikki" with confirm, inside Syötä footer.
- Add inline helper texts as tooltips/`i` icons; remove long explanatory paragraphs from main flow.
- Add compact "Miksi tulos muuttui" diff against previous run (3 bullets) to strengthen user confidence.
- Additional Vite/React improvement: route-level and component-level `Suspense` boundaries with skeletons for chart/table panels.
- This keeps first paint fast and prevents whole-page jank while heavy result widgets/data load.

**Decision (Tulokset visibility):** Keep the Tulokset zone visible before first compute, with a clear empty state (e.g. "Laske ennuste nähdäksesi tulokset" / "Compute to see results") so the user sees where results will appear and is prompted to use Syötä → Laske uudelleen.
