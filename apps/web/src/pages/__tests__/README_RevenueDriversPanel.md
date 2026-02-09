# RevenueDriversPanel.test.tsx

Tests that the Tulot tuloajurit panel reflects `activeBudget.tuloajurit`.

- **Case A:** Budget has vesi + jatevesi drivers with known values → inputs must show those values (not `–` or 0 unless actually 0).
- **Case B:** Budget has empty `tuloajurit` → inputs show placeholder `–` and panel still renders.

## If Case A fails

The failure means the panel is **not** showing driver values. Typical causes:

1. **Wrong data source** – Panel is not receiving `activeBudget.tuloajurit` (e.g. parent passes a different object or stub with empty `tuloajurit`).
2. **Wrong field name** – API or type uses a different name (e.g. `myyty_maara` vs `myytyMaara`); component reads the wrong key.
3. **Values not passed down** – Parent has the data but doesn’t pass `budget={activeBudget}` (or equivalent) into the panel.
4. **Type/format** – API returns numbers or Decimal objects; component expects strings (or vice versa) and doesn’t display.

Fix by ensuring the panel receives the same `Budget` (including `tuloajurit`) that `GET /budgets/:id` returns and that the panel reads `driver.yksikkohinta`, `driver.myytyMaara`, etc., as in the test fixture.
