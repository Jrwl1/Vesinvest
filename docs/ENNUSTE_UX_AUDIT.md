# Ennuste page — UI/UX audit

Date: 2026-02-12  
Scope: Ennuste (Projection) tab: layout, variable inputs (DriverPlanner), results (table/diagram), and bottom content.

---

## 1. Driver variables (DriverPlanner) — "boxes stacked on top of each other"

1. **Four independent blocks in a single column.** DriverPlanner renders 2 services (Vesi, Jätevesi) × 2 fields (Yksikköhinta, Myyty määrä) = four `.driver-field-block` sections. Each block has its own mode toggle (Vuosikohtaiset arvot / % vuodesta X), then either a full year-by-year table or a percent form with another preview table. All four blocks stack vertically with no grid or side-by-side layout, causing long scroll and visual repetition.

2. **No CSS grid for driver-planner.** The component uses `.driver-planner__grid` and `.driver-card` but there is no matching grid layout in `App.css` (only a print-media rule for `.driver-card`). So `.driver-planner__grid` behaves as block flow; cards and field blocks are not arranged in columns.

3. **Redundant year tables in percent mode.** In "% from year X" mode, each of the four blocks shows a full preview table (year + value) for all years. That duplicates the same year range four times and adds length without adding clarity.

4. **Weak visual grouping of service vs field.** Vesi and Jätevesi each contain two field blocks (unit price, volume). The only grouping is an `<h4>` per service; the two fields under one service look like two separate cards, so the relationship "these two inputs belong to Vesi" is understated.

5. **Mode toggle and actions are repeated four times.** Each of the four blocks has its own "Vuosikohtaiset arvot" / "% vuodesta X" toggle and a "Clear" link. Users must set mode and clear separately per block, which is tedious and error-prone.

6. **No compact or summary view.** There is no way to collapse driver blocks or see a one-line summary (e.g. "Vesi: manual 3 years, jätevesi: % from 2025") before expanding. Everything is always expanded.

7. **Save/Reset placement.** Reset and Save sit in a single row under the entire DriverPlanner. Their relationship to the four blocks above is unclear; users may not realize they must Save before Compute.

8. **Dirty-state warning is easy to miss.** The "Tallenna ajurit ennen ennusteen laskentaa" message appears as a small paragraph below the buttons. It does not stand out when the user scrolls down and clicks Compute.

---

## 2. Controls row (top of active projection)

9. **Crowded controls in one row.** Base budget (read-only text), horizon (select), Assumptions (toggle), and Compute (button) are in a single `.controls-row`. On narrow viewports or with long budget names this will wrap or feel cramped; there is no clear visual hierarchy (primary vs secondary).

10. **Assumptions toggle looks like a secondary action.** The Assumptions button uses the same `.btn-toggle` style as other toggles and sits between horizon and Compute. Users may not discover that assumption overrides exist, or may confuse the toggle with "optional settings" rather than "override org defaults for this scenario."

11. **No "last computed" or scenario timestamp.** There is no indication of when the projection was last computed or whether the current view is stale after changing drivers or assumptions. Users can recompute and not notice they are looking at old results.

12. **Compute button dependency is only in tooltip.** The Compute button is disabled when `driverPathsDirty`; the reason is only in the `title` attribute ("Tallenna ajurit ennen..."). Screen readers and users who do not hover may not understand why Compute is disabled.

---

## 3. Create scenario form

13. **Create form is an inline card, not a modal.** When "Luo skenaario" is clicked, the create form appears as a card in the main flow (name, base budget, horizon). It pushes down the rest of the page and can feel like "random" content if the user was focused on the scenario selector or controls.

14. **No clear separation from "active projection" content.** The create form and the active-projection controls/results are siblings; when the form is open, the scenario tabs and controls below still show the current projection, which can be confusing (e.g. "Am I editing this scenario or creating a new one?").

---

## 4. Verdict and result area

15. **Verdict card is visually heavy.** The verdict (Kestämätön / Tiukka / Kestävä) uses a large card with icon, title, description, and three stats (average result, cumulative, deficit years). It always appears when there is computed data and takes a lot of vertical space before the user reaches the table or diagram.

16. **Hint banner (no drivers) appears between verdict and tabs.** The "Vesihinta ja vesimäärä ovat 0, koska..." banner is placed after the verdict and before the Taulukko/Diagrammi tabs. That breaks the flow from "summary" → "view choice" → "data"; the hint could be integrated into the verdict area or the table header when relevant.

17. **Taulukko / Diagrammi tabs are small.** The result view tabs are two text buttons. They can be overlooked, especially after a long scroll through driver blocks and verdict.

18. **Diagram view shows five separate chart cards.** In Diagrammi mode, ProjectionCharts renders five `.projection-chart-card` elements (revenue, net result, cumulative, water price, volume) in a responsive grid. On large screens many charts appear at once, which can feel like "a lot of random info" rather than a single coherent diagram view.

---

## 5. Main table (Taulukko)

19. **Wide table with many columns.** The projection table has 10 columns (year, revenue, expenses, baseline dep., investment dep., investments, net result, cumulative, water price, volume). Horizontal scroll on small screens is likely; no column pinning or sticky first column.

20. **Depreciation columns may be noise for many users.** Baseline and investment depreciation columns are always shown. For users who only care about revenue, result, and volume, these add clutter. There is no option to hide or collapse columns.

21. **Base year badge and deficit styling.** The base year has a "base" badge; deficit rows are styled. This is good but can get lost in a long table; no summary row or sticky header on scroll.

---

## 6. Bottom content — "a lot of random info"

22. **RevenueReport is always visible below the table/diagram.** After the main result (table or diagram), the page always renders `RevenueReport`: a card titled "Tulot — [scenario name]" with multiple sections. There is no collapse or "show details" — it is always on.

23. **RevenueReport contains three distinct sections.**  
    - **Revenue drivers per year:** table with year, unit price, sold volume, water revenue, wastewater revenue, total.  
    - **Depreciation split:** table with baseline vs investment-driven depreciation by year (only if non-zero).  
    - **Base-year revenue summary:** table with budget name, amount (drivers + manual revenue lines + total).  
    This is a lot of structured data in one block; purpose (e.g. "for print" or "detailed breakdown") is not communicated.

24. **Overlap with main table.** The main projection table already shows revenue, water price, volume, and depreciation by year. RevenueReport repeats revenue and depreciation in a different layout (more columns, different grouping). Users may not understand why both exist or when to use which.

25. **No print-only or export-only treatment.** RevenueReport is described in code as "Printable revenue breakdown report" but it is always visible on screen. If the intent is mainly for PDF/print, it could be hidden on screen and only included in export, or placed behind a "Show revenue breakdown" toggle.

26. **Footer / no clear end of page.** After RevenueReport there is no footer or "end of Ennuste" cue. On a long scroll the page just ends with the last report table, which contributes to the feeling of "random info at the bottom."

---

## 7. Scenario selector and global layout

27. **Scenario tabs and delete button.** Scenario names appear as tabs; delete is a separate icon button. The relationship (delete = delete this scenario) is only in the button title. No confirmation state or "are you sure?" before the native confirm dialog.

28. **Long page with no anchor links or sticky nav.** The page has a single linear flow: header → scenario → controls → assumptions (if open) → driver planner → verdict → tabs → table/diagram → RevenueReport. There is no way to jump to "variables," "results," or "export" without scrolling.

29. **Empty state and no-projection state.** When there are no projections, an empty state and a scaffold table are shown; when there are no budgets, a different empty state is shown. These are reasonable but sit in the same long-page context; the CTA (e.g. "Create scenario" or "Load demo") could be more prominent.

---

## 8. Accessibility and small fixes

30. **Assumption table override cells.** The assumptions override table uses custom `AssumptionInput` components. Ensure labels and aria attributes are present so screen readers associate "override value" with the correct assumption row.

31. **DriverPlanner inputs.** Year-by-year inputs and percent inputs (base year, base value, annual %) may not all have visible labels or `aria-label` where the label is only in a parent `<label>` that wraps multiple controls.

32. **Verdict card semantics.** The verdict card uses emoji (✅⚠️🔴) and strong text. Consider `role="status"` or `aria-live` if the verdict updates after recompute so assistive tech announces the change.

33. **Result view tabs.** The Taulukko/Diagrammi switcher should use a proper tab pattern (e.g. `role="tablist"`, `role="tab"`, `aria-selected`) so keyboard and screen reader users get correct tab semantics.

---

## 9. Summary table

| # | Area | Issue |
|---|------|--------|
| 1–8 | DriverPlanner | Four blocks stacked; no grid; redundant tables; weak grouping; repeated toggles; no summary; Save/Reset and dirty warning easy to miss |
| 9–12 | Controls row | Crowded; Assumptions understated; no "last computed"; Compute disable reason only in tooltip |
| 13–14 | Create scenario | Inline card not modal; unclear separation from active scenario |
| 15–18 | Verdict / result | Heavy verdict card; hint placement; small view tabs; diagram = five charts at once |
| 19–21 | Main table | Wide; many columns; depreciation always visible; no column hide |
| 22–26 | Bottom (RevenueReport) | Always visible; three sections; overlaps main table; purpose unclear; no "end of page" |
| 27–29 | Global | Delete scenario affordance; no anchor/sticky nav; empty states could be stronger |
| 30–33 | A11y | Assumption/driver labels; verdict live region; result tabs semantics |

---

## Next steps (for a UI/UX betterment plan)

- Prioritise: e.g. (1) DriverPlanner layout and grouping, (2) bottom content (RevenueReport) visibility and purpose, (3) controls hierarchy and "last computed," (4) create-scenario modal vs inline, (5) diagram and table UX, (6) a11y.
- Align with `docs/PROJECTION_UX_PLAN.md` (same-screen variables, diagram as sub-view, progressive disclosure) so changes support the locked UX goals.
- Consider a follow-up sprint or backlog items that reference this audit (e.g. "ENNUSTE-AUDIT-01: DriverPlanner grid layout").
