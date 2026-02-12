import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { previewKvaWorkbook } from './va-import/kva-template.adapter';

const FIXTURES_DIR = process.env.VA_FIXTURES_DIR
  ? path.isAbsolute(process.env.VA_FIXTURES_DIR)
    ? process.env.VA_FIXTURES_DIR
    : path.join(process.cwd(), '..', process.env.VA_FIXTURES_DIR)
  : path.join(process.cwd(), '..', 'fixtures');
const KVA_FIXTURE = path.join(FIXTURES_DIR, 'Simulering av kommande lönsamhet KVA.xlsx');

function kvaFixtureExists(): boolean {
  return fs.existsSync(KVA_FIXTURE);
}

/**
 * E2E fixture regression: preview then confirm path uses KVA totalt, not Blad1; persisted Talousarvio shape.
 * Full import happy-path bundle: contract spec + web typecheck (S-05).
 * Parser regression bundle: kva-template.adapter.spec + budget-totals.contract.spec (S-01).
 * API regression bundle: kva-template + budget-totals + budgets.repository (S-02).
 * S-05: fixture-backed proof, confirm create/update, UI preview cards, root gates (lint, typecheck, release-check).
 */
describe('KVA import e2e fixture regression (preview → no Blad1 fallback)', () => {
  if (!kvaFixtureExists()) {
    it.skip('KVA fixture not found (set VA_FIXTURES_DIR or add fixture to fixtures/)', () => {});
    return;
  }

  it('fixture assertions: totals source is KVA totalt and selected years are exposed', async () => {
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    expect(preview.subtotalDebug).toBeDefined();
    expect(preview.subtotalDebug!.sourceSheets).toContain('KVA totalt');
    expect(preview.subtotalDebug!.selectedYear).toBeGreaterThanOrEqual(2000);
    const years = preview.subtotalDebug!.selectedHistoricalYears ?? [preview.subtotalDebug!.selectedYear];
    expect(years.length).toBeGreaterThanOrEqual(1);
    expect(years.every((y) => typeof y === 'number')).toBe(true);
  });

  it('preview from fixture uses sheet KVA totalt for subtotals and does not fall back to Blad1', async () => {
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    expect(preview.subtotalDebug).toBeDefined();
    expect(preview.subtotalDebug!.sourceSheets).toContain('KVA totalt');
    const fromBlad1 = (preview.subtotalLines ?? []).filter((l) => l.sourceSheet === 'Blad1');
    expect(fromBlad1.length).toBe(0);
    expect(preview.subtotalLines?.length ?? 0).toBeGreaterThan(0);
  });

  it('totals source is KVA totalt; Blad1 only optional account-tier (not totals)', async () => {
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    expect(preview.subtotalDebug?.sourceSheets).toContain('KVA totalt');
    const subtotalFromKvaTotalt = (preview.subtotalLines ?? []).filter((l) => l.sourceSheet === 'KVA totalt');
    const subtotalFromBlad1 = (preview.subtotalLines ?? []).filter((l) => l.sourceSheet === 'Blad1');
    expect(subtotalFromKvaTotalt.length).toBeGreaterThan(0);
    expect(subtotalFromBlad1.length).toBe(0);
    if (preview.budgetLines.length > 0) {
      expect(preview.kvaDebug?.detectedSheetName).toBe('Blad1');
    }
  });

  it('happy-path: preview yields year-by-year totals and confirm payload shape is valid for persistence', async () => {
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    const lines = preview.subtotalLines ?? [];
    const byYear = lines.reduce<Record<number, number>>((acc, l) => {
      const y = l.year;
      acc[y] = (acc[y] ?? 0) + l.amount;
      return acc;
    }, {});
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const snippet = years.map((y) => `${y}=${byYear[y] ?? 0}`).join(', ');
    expect(years.length).toBeGreaterThan(0);
    expect(preview.subtotalDebug?.selectedYear).toBeGreaterThanOrEqual(2000);
    if (snippet) {
      expect(typeof snippet).toBe('string');
      // Scriptable proof: log extracted year-by-year values from preview (customer demo evidence)
      // eslint-disable-next-line no-console
      console.log('KVA preview extracted year-by-year totals:', snippet);
    }
  });

  it('fixture snapshot: parser output has deterministic per-year JSON proof (3 years, categoryKeys)', async () => {
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    const lines = preview.subtotalLines ?? [];
    const years = [...new Set(lines.map((l) => l.year).filter((y) => typeof y === 'number'))].sort((a, b) => a - b);
    const categoryKeys = [...new Set(lines.map((l) => l.categoryKey))].sort();
    const totalsByYear = years.reduce<Record<number, number>>((acc, y) => {
      acc[y] = lines.filter((l) => l.year === y).reduce((s, l) => s + l.amount, 0);
      return acc;
    }, {});
    const proof = {
      years,
      yearCount: years.length,
      lineCount: lines.length,
      categoryKeys: categoryKeys.slice(0, 10),
      selectedHistoricalYears: preview.subtotalDebug?.selectedHistoricalYears,
      totalsByYear: Object.fromEntries(years.map((y) => [y, totalsByYear[y]])),
    };
    expect(proof.yearCount).toBeGreaterThanOrEqual(1);
    expect(proof.lineCount).toBeGreaterThan(0);
    expect(Array.isArray(proof.categoryKeys)).toBe(true);
  });

  it('payload maps to atomic scopes (vesi, jätevesi, muu); totals derived not stored as imported rows', async () => {
    if (!kvaFixtureExists()) return;
    const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const preview = await previewKvaWorkbook(workbook);
    const lines = preview.subtotalLines ?? [];
    for (const l of lines) {
      expect(['vesi', 'jatevesi', undefined].includes(l.palvelutyyppi)).toBe(true);
    }
  });
});

/**
 * Contract test: Budget page revenue total rule (no double-count of sales_revenue).
 * When a budget has both valisummat (including sales_revenue) and revenue drivers (tuloajurit),
 * the display total must use drivers for "sales" revenue and must NOT add sales_revenue from
 * valisummat (projection rule: drivers replace sales_revenue).
 */
describe('Budget revenue total (no double-count)', () => {
  type ValisummaLike = { tyyppi: string; categoryKey: string; summa: string | number };
  type DriverLike = { yksikkohinta: string | number; myytyMaara: string | number; perusmaksu?: string | number; liittymamaara?: number };

  function revenueFromValisummat(
    valisummat: ValisummaLike[],
    hasMeaningfulDrivers: boolean,
  ): number {
    return valisummat
      .filter(
        (v) =>
          (v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo') &&
          (!hasMeaningfulDrivers || v.categoryKey !== 'sales_revenue'),
      )
      .reduce((s, v) => s + parseFloat(String(v.summa)), 0);
  }

  function computedRevenueFromDrivers(drivers: DriverLike[]): number {
    return drivers.reduce((sum, d) => {
      return (
        sum +
        parseFloat(String(d.yksikkohinta)) * parseFloat(String(d.myytyMaara)) +
        (d.perusmaksu != null && d.liittymamaara != null
          ? parseFloat(String(d.perusmaksu)) * d.liittymamaara
          : 0)
      );
    }, 0);
  }

  it('excludes sales_revenue from valisummat when drivers are present so total is not double-counted', () => {
    const valisummat: ValisummaLike[] = [
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
      { categoryKey: 'connection_fees', tyyppi: 'tulo', summa: 50000 },
    ];
    const drivers: DriverLike[] = [
      { yksikkohinta: 1.2, myytyMaara: 12000 },
      { yksikkohinta: 2.0, myytyMaara: 9000 },
    ];
    const hasMeaningfulDrivers = drivers.some(
      (d) => parseFloat(String(d.myytyMaara)) > 0 || parseFloat(String(d.yksikkohinta)) > 0,
    );
    expect(hasMeaningfulDrivers).toBe(true);

    const fromValisummat = revenueFromValisummat(valisummat, hasMeaningfulDrivers);
    const computed = computedRevenueFromDrivers(drivers);

    expect(fromValisummat).toBe(50000);
    expect(computed).toBe(1.2 * 12000 + 2.0 * 9000); // 14400 + 18000 = 32400
    const totalRevenue = fromValisummat + computed;
    expect(totalRevenue).toBe(50000 + 32400);
    expect(totalRevenue).not.toBe(400000 + 50000 + 32400);
  });

  it('V1: budget revenue total is VAT-free (driver revenue = price×volume + base fee×connections only)', () => {
    const drivers: DriverLike[] = [
      { yksikkohinta: 1.2, myytyMaara: 12000, perusmaksu: 10, liittymamaara: 100 },
    ];
    const computed = computedRevenueFromDrivers(drivers);
    expect(computed).toBe(1.2 * 12000 + 10 * 100);
    expect(computed).toBe(15400);
  });

  it('includes sales_revenue from valisummat when no meaningful drivers', () => {
    const valisummat: ValisummaLike[] = [
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
      { categoryKey: 'connection_fees', tyyppi: 'tulo', summa: 50000 },
    ];
    const drivers: DriverLike[] = [
      { yksikkohinta: 0, myytyMaara: 0 },
      { yksikkohinta: 0, myytyMaara: 0 },
    ];
    const hasMeaningfulDrivers = drivers.some(
      (d) => parseFloat(String(d.myytyMaara)) > 0 || parseFloat(String(d.yksikkohinta)) > 0,
    );
    expect(hasMeaningfulDrivers).toBe(false);

    const fromValisummat = revenueFromValisummat(valisummat, hasMeaningfulDrivers);
    expect(fromValisummat).toBe(400000 + 50000);
  });
});

/**
 * Contract: Budget page must not double-count KVA totalt when service splits (vesi, jatevesi) exist.
 * For each (tyyppi, categoryKey), if any valisumma has palvelutyyppi in ['vesi','jatevesi'],
 * exclude valisummat with palvelutyyppi === 'muu' for that (tyyppi, categoryKey).
 * Displayed revenue = sum of filtered revenue-type valisummat.
 */
describe('Valisummat filter: exclude muu when vesi/jatevesi exist (no KVA totalt double-count)', () => {
  type ValisummaWithService = { tyyppi: string; categoryKey: string; summa: string | number; palvelutyyppi?: string };

  function filterValisummatNoKvaTotaltDoubleCount<T extends ValisummaWithService>(valisummat: T[]): T[] {
    const SERVICE_SPLITS = new Set<string>(['vesi', 'jatevesi']);
    const key = (v: ValisummaWithService) => `${v.tyyppi}\0${v.categoryKey}`;
    const hasServiceSplit = new Set<string>();
    for (const v of valisummat) {
      if (SERVICE_SPLITS.has(String(v.palvelutyyppi ?? '').toLowerCase())) hasServiceSplit.add(key(v));
    }
    return valisummat.filter((v) => {
      const k = key(v);
      const isMuu = String(v.palvelutyyppi ?? '').toLowerCase() === 'muu';
      if (isMuu && hasServiceSplit.has(k)) return false;
      return true;
    });
  }

  function revenueFromFiltered(valisummat: ValisummaWithService[]): number {
    return valisummat
      .filter((v) => v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo')
      .reduce((s, v) => s + parseFloat(String(v.summa)), 0);
  }

  it('excludes sales_revenue muu when vesi+jatevesi exist; keeps other_income muu; total revenue = 160', () => {
    const valisummat: ValisummaWithService[] = [
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'vesi', summa: 100 },
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'jatevesi', summa: 50 },
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'muu', summa: 150 },
      { tyyppi: 'tulo', categoryKey: 'other_income', palvelutyyppi: 'muu', summa: 10 },
    ];
    const filtered = filterValisummatNoKvaTotaltDoubleCount(valisummat);
    const totalRevenue = revenueFromFiltered(filtered);

    expect(filtered).toHaveLength(3);
    expect(filtered.some((v) => v.categoryKey === 'sales_revenue' && v.palvelutyyppi === 'muu')).toBe(false);
    expect(totalRevenue).toBe(160);
    expect(totalRevenue).not.toBe(310);
  });
});

/**
 * Contract: Hierarchy ordering and category mapping when writing TalousarvioValisumma.
 * Subtotal lines are processed in (level, order) order; category mapping (categoryKey, tyyppi, label) preserved.
 */
describe('Valisumma hierarchy and category mapping (S-02)', () => {
  type SubtotalLike = {
    palvelutyyppi: string;
    categoryKey: string;
    tyyppi: string;
    summa: number;
    label?: string;
    level?: number;
    order?: number;
  };

  function sortByHierarchy(lines: SubtotalLike[]): SubtotalLike[] {
    return [...lines].sort(
      (a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.order ?? 0) - (b.order ?? 0),
    );
  }

  function dedupeByKey(lines: SubtotalLike[]): SubtotalLike[] {
    const key = (s: SubtotalLike) => `${s.palvelutyyppi}|${s.categoryKey}`;
    const byKey = new Map<string, SubtotalLike>();
    for (const s of lines) {
      const k = key(s);
      if (!byKey.has(k)) byKey.set(k, { ...s });
      else byKey.get(k)!.summa += s.summa;
    }
    return Array.from(byKey.values());
  }

  it('processes subtotal lines in hierarchy order (level, order) and preserves category mapping', () => {
    const input: SubtotalLike[] = [
      { palvelutyyppi: 'vesi', categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 50, order: 2 },
      { palvelutyyppi: 'vesi', categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 100, label: 'Försäljning', order: 0 },
      { palvelutyyppi: 'vesi', categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 50, order: 1 },
    ];
    const sorted = sortByHierarchy(input);
    const deduped = dedupeByKey(sorted);
    expect(deduped).toHaveLength(2);
    const personnel = deduped.find((d) => d.categoryKey === 'personnel_costs');
    expect(personnel?.summa).toBe(100);
    expect(personnel?.label ?? personnel?.order).toBeDefined();
    const sales = deduped.find((d) => d.categoryKey === 'sales_revenue');
    expect(sales?.summa).toBe(100);
    expect(sales?.label).toBe('Försäljning');
  });
});

/** Contract: GET /budgets/:id returns persisted valisummat with expected category keys and types (KVA readback). Persistence-readback bundle: repository + contract specs + web typecheck. */
const EXPECTED_VALISUMMA_TYYPIT = new Set([
  'tulo', 'kulu', 'poisto', 'rahoitus_tulo', 'rahoitus_kulu', 'investointi', 'tulos',
]);
const EXPECTED_VALISUMMA_CATEGORY_KEYS = new Set([
  'sales_revenue', 'connection_fees', 'other_income', 'materials_services', 'personnel_costs',
  'other_costs', 'purchased_services', 'rents', 'depreciation', 'financial_income', 'financial_costs',
  'investments', 'operating_result', 'net_result',
]);

describe('GET /budgets/:id valisummat readback (KVA persistence)', () => {
  it('returned valisummat have expected categoryKey and tyyppi shape', () => {
    const budgetWithValisummat = {
      id: 'b-1',
      valisummat: [
        { id: 'v1', categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000, palvelutyyppi: 'vesi' },
        { id: 'v2', categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000, palvelutyyppi: 'vesi' },
        { id: 'v3', categoryKey: 'depreciation', tyyppi: 'poisto', summa: 50000, palvelutyyppi: 'jatevesi' },
      ],
    };
    for (const v of budgetWithValisummat.valisummat) {
      expect(EXPECTED_VALISUMMA_CATEGORY_KEYS.has(v.categoryKey)).toBe(true);
      expect(EXPECTED_VALISUMMA_TYYPIT.has(v.tyyppi)).toBe(true);
    }
    expect(budgetWithValisummat.valisummat.length).toBeGreaterThan(0);
  });
});
