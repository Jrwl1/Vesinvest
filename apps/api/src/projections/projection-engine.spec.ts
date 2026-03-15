import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ProjectionEngine,
  AssumptionMap,
  RevenueDriverInput,
  SubtotalInput,
} from './projection-engine.service';
import { ProjectionsService } from './projections.service';
import { ProjectionsRepository } from './projections.repository';
import { DriverPaths } from './driver-paths';

describe('ProjectionEngine', () => {
  let engine: ProjectionEngine;

  beforeEach(() => {
    engine = new ProjectionEngine();
  });

  const DEFAULT_ASSUMPTIONS: AssumptionMap = {
    inflaatio: 0.025,
    energiakerroin: 0.05,
    vesimaaran_muutos: -0.01,
    hintakorotus: 0.03,
    investointikerroin: 0.02,
  };

  const DRIVERS: RevenueDriverInput[] = [
    {
      palvelutyyppi: 'vesi',
      yksikkohinta: 1.2,
      myytyMaara: 12000,
      perusmaksu: 0,
      liittymamaara: 0,
    },
    {
      palvelutyyppi: 'jatevesi',
      yksikkohinta: 2.0,
      myytyMaara: 9000,
      perusmaksu: 0,
      liittymamaara: 0,
    },
  ];

  describe('compute (legacy account-line path)', () => {
    it('produces correct base year and projects forward', () => {
      const lines = [
        {
          tiliryhma: '4100',
          nimi: 'Energi',
          tyyppi: 'kulu' as const,
          summa: 50000,
        },
        {
          tiliryhma: '4200',
          nimi: 'Personal',
          tyyppi: 'kulu' as const,
          summa: 100000,
        },
        {
          tiliryhma: '5100',
          nimi: 'Maskin',
          tyyppi: 'investointi' as const,
          summa: 30000,
        },
      ];

      const result = engine.compute(
        2024,
        3,
        lines,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result).toHaveLength(4); // base year + 3 projection years
      expect(result[0].vuosi).toBe(2024);
      expect(result[3].vuosi).toBe(2027);
      // Base year revenue = driver revenue
      expect(result[0].tulotYhteensa).toBeGreaterThan(0);
      // Expenses grow
      expect(result[3].kulutYhteensa).toBeGreaterThan(result[0].kulutYhteensa);
      // Cumulative is running sum
      expect(result[2].kumulatiivinenTulos).toBeCloseTo(
        result[0].tulos + result[1].tulos + result[2].tulos,
        1,
      );
    });
  });

  describe('computeFromSubtotals', () => {
    const SUBTOTALS: SubtotalInput[] = [
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
      { categoryKey: 'connection_fees', tyyppi: 'tulo', summa: 5000 },
      { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
      { categoryKey: 'other_costs', tyyppi: 'kulu', summa: 50000 },
      { categoryKey: 'depreciation', tyyppi: 'poisto', summa: 60000 },
      { categoryKey: 'financial_income', tyyppi: 'rahoitus_tulo', summa: 2000 },
      { categoryKey: 'financial_costs', tyyppi: 'rahoitus_kulu', summa: 5000 },
      { categoryKey: 'investments', tyyppi: 'investointi', summa: 40000 },
    ];

    it('produces correct number of years', () => {
      const result = engine.computeFromSubtotals(
        2024,
        5,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result).toHaveLength(6); // base year + 5 projection years
      expect(result[0].vuosi).toBe(2024);
      expect(result[5].vuosi).toBe(2029);
    });

    it('revenue comes from drivers, not sales_revenue subtotal', () => {
      const result = engine.computeFromSubtotals(
        2024,
        0,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Base year: driver revenue = 1.2*12000 + 2.0*9000 = 14400+18000 = 32400
      // Plus connection_fees = 5000, financial_income = 2000
      const expectedBaseRevenue = 32400 + 5000 + 2000;
      expect(result[0].tulotYhteensa).toBeCloseTo(expectedBaseRevenue, 0);
    });

    it('operating costs grow with inflation', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Year 0: costs = 100000+50000 = 150000
      // Year 1: costs = 150000 * 1.025 = 153750
      const year0CostSubtotals = result[0].erittelyt.kulut.reduce(
        (s, l) => s + l.summa,
        0,
      );
      const year1CostSubtotals = result[1].erittelyt.kulut.reduce(
        (s, l) => s + l.summa,
        0,
      );
      expect(year0CostSubtotals).toBeCloseTo(150000, 0);
      expect(year1CostSubtotals).toBeCloseTo(150000 * 1.025, 0);
    });

    it('applies energiakerroin to energy subtotal categories and inflaatio to other costs', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'energy_costs', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'other_costs', tyyppi: 'kulu', summa: 100000 },
      ];
      const assumptions: AssumptionMap = {
        ...DEFAULT_ASSUMPTIONS,
        inflaatio: 0.01,
        energiakerroin: 0.2,
      };
      const result = engine.computeFromSubtotals(
        2024,
        1,
        subtotals,
        DRIVERS,
        assumptions,
      );
      const year1Energy = result[1].erittelyt.kulut.find(
        (line) => line.tiliryhma === 'energy_costs',
      );
      const year1Other = result[1].erittelyt.kulut.find(
        (line) => line.tiliryhma === 'other_costs',
      );
      expect(year1Energy?.summa).toBeCloseTo(120000, 0);
      expect(year1Other?.summa).toBeCloseTo(101000, 0);
    });

    it('applies henkilostokerroin to Finnish henkilostokulut category', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'henkilostokulut', tyyppi: 'kulu', summa: 100000 },
      ];
      const assumptions: AssumptionMap = {
        ...DEFAULT_ASSUMPTIONS,
        inflaatio: 0.01,
        henkilostokerroin: 0.2,
      };

      const result = engine.computeFromSubtotals(
        2024,
        1,
        subtotals,
        DRIVERS,
        assumptions,
      );
      const year1Personnel = result[1].erittelyt.kulut.find(
        (line) => line.tiliryhma === 'henkilostokulut',
      );
      expect(year1Personnel?.summa).toBeCloseTo(120000, 0);
    });

    it('does not double-count liikevaihto when drivers are present', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'liikevaihto', tyyppi: 'tulo', summa: 400000 },
        { categoryKey: 'omistajan_tuki', tyyppi: 'tulo', summa: 7000 },
        {
          categoryKey: 'rahoitustuotot_ja_kulut',
          tyyppi: 'rahoitus_tulo',
          summa: 2000,
        },
      ];

      const result = engine.computeFromSubtotals(
        2024,
        0,
        subtotals,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Driver revenue = 1.2*12000 + 2.0*9000 = 32400
      // liikevaihto is the same concept as sales_revenue and must NOT be added as other income
      // remaining income lines: omistajan_tuki + rahoitustuotot_ja_kulut
      expect(result[0].tulotYhteensa).toBeCloseTo(32400 + 7000 + 2000, 0);
    });

    it('reduces next-year revenue when fee increases are delayed and volume decline worsens', () => {
      const baseResult = engine.computeFromSubtotals(
        2024,
        1,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      const stressResult = engine.computeFromSubtotals(
        2024,
        1,
        SUBTOTALS,
        DRIVERS,
        {
          ...DEFAULT_ASSUMPTIONS,
          hintakorotus: 0,
          vesimaaran_muutos: -0.03,
        },
      );

      expect(stressResult[1].tulotYhteensa).toBeLessThan(
        baseResult[1].tulotYhteensa,
      );
    });

    it('applies manual henkilosto growth overrides for first years, then falls back to default henkilostokerroin', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
      ];
      const assumptions: AssumptionMap = {
        ...DEFAULT_ASSUMPTIONS,
        henkilostokerroin: 0.1,
        henkilosto_muutos_2025: -0.05,
        henkilosto_muutos_2026: 0.2,
      };
      const result = engine.computeFromSubtotals(
        2024,
        3,
        subtotals,
        DRIVERS,
        assumptions,
      );
      const personnelLineAt = (idx: number) =>
        result[idx].erittelyt.kulut.find(
          (line) => line.tiliryhma === 'personnel_costs',
        )?.summa ?? 0;
      expect(personnelLineAt(0)).toBeCloseTo(100000, 0); // 2024
      expect(personnelLineAt(1)).toBeCloseTo(95000, 0); // 2025 override -5%
      expect(personnelLineAt(2)).toBeCloseTo(114000, 0); // 2026 override +20% from 2025
      expect(personnelLineAt(3)).toBeCloseTo(125400, 0); // 2027 default +10%
    });

    it('routes category growth overrides to explicit materials/personnel/other buckets only', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'materials_services', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'other_costs', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'misc_costs', tyyppi: 'kulu', summa: 100000 },
      ];
      const result = engine.computeFromSubtotals(
        2024,
        1,
        subtotals,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        undefined,
        undefined,
        {
          2025: {
            categoryGrowthPct: { personnel: 10, energy: 20, opexOther: 30 },
          },
        },
      );

      const year2025 = result[1].erittelyt.kulut;
      const byKey = (key: string) =>
        year2025.find((line) => line.tiliryhma === key)?.summa ?? 0;

      expect(byKey('materials_services')).toBeCloseTo(120000, 0);
      expect(byKey('personnel_costs')).toBeCloseTo(110000, 0);
      expect(byKey('other_costs')).toBeCloseTo(130000, 0);
      // Unknown cost categories stay on default inflation path (2.5%), not opexOther override.
      expect(byKey('misc_costs')).toBeCloseTo(102500, 0);
    });

    it('depreciation is flat (does not grow)', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // kulutYhteensa includes costs + depreciation + financial costs
      // Depreciation = 60000 in every year (flat)
      // Year 0: kulut = 150000 + 60000 + 5000 = 215000
      expect(result[0].kulutYhteensa).toBeCloseTo(215000, 0);
      // Year 3: kulut includes grown costs + flat depreciation + flat financial costs
      const year3Costs = 150000 * Math.pow(1.025, 3);
      expect(result[3].kulutYhteensa).toBeCloseTo(year3Costs + 60000 + 5000, 0);
    });

    it('S-03: baseline depreciation (poistoPerusta) equals base-year poisto total and is flat across years', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      const baseYearPoistoTotal = 60000; // SUBTOTALS has one poisto: depreciation 60000
      for (let i = 0; i < result.length; i++) {
        expect(result[i].poistoPerusta).toBeCloseTo(baseYearPoistoTotal, 0);
        expect(result[i].poistoInvestoinneista).toBe(0);
      }
    });

    it('S-03: investment-driven depreciation (poistoInvestoinneista) is a separate component from investments', () => {
      const assumptions = {
        ...DEFAULT_ASSUMPTIONS,
        investoinninPoistoOsuus: 0.1,
      };
      const result = engine.computeFromSubtotals(
        2024,
        2,
        SUBTOTALS,
        DRIVERS,
        assumptions,
      );
      // Year 0: investments = 40000, so poistoInvestoinneista = 4000
      expect(result[0].investoinnitYhteensa).toBeCloseTo(40000, 0);
      expect(result[0].poistoInvestoinneista).toBeCloseTo(4000, 0);
      // Year 2: investments = 40000 * 1.02^2
      const invY2 = 40000 * Math.pow(1.02, 2);
      expect(result[2].investoinnitYhteensa).toBeCloseTo(invY2, 0);
      expect(result[2].poistoInvestoinneista).toBeCloseTo(invY2 * 0.1, 0);
      // kulutYhteensa includes both poistoPerusta and poistoInvestoinneista
      expect(result[0].kulutYhteensa).toBeGreaterThanOrEqual(
        result[0].poistoPerusta + result[0].poistoInvestoinneista,
      );
    });

    it('applies class-based depreciation cohorts when rules and class allocations are provided', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'investments', tyyppi: 'investointi', summa: 1000 },
      ];
      const assumptions = {
        ...DEFAULT_ASSUMPTIONS,
        investointikerroin: 0,
        investoinninPoistoOsuus: 0.1,
        depreciationRules: [
          { classKey: 'network', method: 'straight-line', linearYears: 5 },
          {
            classKey: 'plant',
            method: 'custom-annual-schedule',
            annualSchedule: [50, 30, 20],
          },
          { classKey: 'land', method: 'none' },
        ],
      } as unknown as AssumptionMap;

      const result = engine.computeFromSubtotals(
        2024,
        2,
        subtotals,
        DRIVERS,
        assumptions,
        undefined,
        undefined,
        undefined,
        {
          2024: {
            investmentClassAllocations: { network: 50, plant: 30, land: 20 },
          },
          2025: {
            investmentClassAllocations: { network: 50, plant: 30, land: 20 },
          },
          2026: {
            investmentClassAllocations: { network: 50, plant: 30, land: 20 },
          },
        } as any,
      );

      expect(result[0].poistoInvestoinneista).toBeCloseTo(250, 2);
      expect(result[1].poistoInvestoinneista).toBeCloseTo(440, 2);
      expect(result[2].poistoInvestoinneista).toBeCloseTo(600, 2);
    });

    it('keeps legacy investment depreciation fallback when class rules are not configured', () => {
      const subtotals: SubtotalInput[] = [
        { categoryKey: 'investments', tyyppi: 'investointi', summa: 1000 },
      ];
      const assumptions = {
        ...DEFAULT_ASSUMPTIONS,
        investointikerroin: 2,
        investoinninPoistoOsuus: 0.1,
      };

      const result = engine.computeFromSubtotals(
        2024,
        1,
        subtotals,
        DRIVERS,
        assumptions,
        undefined,
        undefined,
        undefined,
        {
          2024: {
            investmentClassAllocations: { network: 100 },
          },
        } as any,
      );

      expect(result[0].investoinnitYhteensa).toBeCloseTo(1000, 2);
      expect(result[0].poistoInvestoinneista).toBeCloseTo(100, 2);
      expect(result[1].investoinnitYhteensa).toBeCloseTo(3000, 2);
      expect(result[1].poistoInvestoinneista).toBeCloseTo(300, 2);
    });

    it('investments grow with investointikerroin', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result[0].investoinnitYhteensa).toBeCloseTo(40000, 0);
      expect(result[3].investoinnitYhteensa).toBeCloseTo(
        40000 * Math.pow(1.02, 3),
        0,
      );
    });

    it('financial items are flat', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Financial income is in tulotYhteensa, financial costs in kulutYhteensa
      // Both should be flat
      // Year 0 vs year 3: the financial portions should be the same
      // We verify by checking that the difference in kulutYhteensa comes only from cost growth
      const costGrowth = 150000 * (Math.pow(1.025, 3) - 1);
      const kulutDiff = result[3].kulutYhteensa - result[0].kulutYhteensa;
      expect(kulutDiff).toBeCloseTo(costGrowth, 0);
    });

    it('result formula: tulos = income minus expenses (revenue - kulut)', () => {
      const result = engine.computeFromSubtotals(
        2024,
        0,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result[0].tulos).toBeCloseTo(
        result[0].tulotYhteensa - result[0].kulutYhteensa,
        2,
      );
    });

    it('cumulative is running sum of tulos', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      let cumSum = 0;
      for (const yr of result) {
        cumSum += yr.tulos;
        expect(yr.kumulatiivinenTulos).toBeCloseTo(cumSum, 1);
      }
    });

    it('works with empty subtotals (drivers only)', () => {
      const result = engine.computeFromSubtotals(
        2024,
        2,
        [],
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result).toHaveLength(3);
      expect(result[0].tulotYhteensa).toBeGreaterThan(0);
      expect(result[0].kulutYhteensa).toBe(0);
    });

    it('excludes result-type subtotals from computation', () => {
      const withResult: SubtotalInput[] = [
        ...SUBTOTALS,
        { categoryKey: 'operating_result', tyyppi: 'tulos', summa: 999999 },
      ];
      const result1 = engine.computeFromSubtotals(
        2024,
        0,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      const result2 = engine.computeFromSubtotals(
        2024,
        0,
        withResult,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Adding a 'tulos' subtotal should not change any numbers
      expect(result1[0].tulos).toBeCloseTo(result2[0].tulos, 2);
    });

    it('driver revenue grows with hintakorotus and vesimaaran_muutos', () => {
      const result = engine.computeFromSubtotals(
        2024,
        1,
        [],
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Year 0: driver revenue = 1.2*12000 + 2.0*9000 = 32400
      // Year 1: price*1.03, volume*0.99
      const y1Price_vesi = 1.2 * 1.03;
      const y1Vol_vesi = 12000 * 0.99;
      const y1Price_jv = 2.0 * 1.03;
      const y1Vol_jv = 9000 * 0.99;
      const expectedY1 = y1Price_vesi * y1Vol_vesi + y1Price_jv * y1Vol_jv;
      expect(result[1].tulotYhteensa).toBeCloseTo(expectedY1, -2); // tolerance 100 (rounding/order)
    });

    it('produces consistent results regardless of subtotal ordering', () => {
      const shuffled: SubtotalInput[] = [
        { categoryKey: 'investments', tyyppi: 'investointi', summa: 40000 },
        { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
        { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'depreciation', tyyppi: 'poisto', summa: 60000 },
      ];
      const ordered: SubtotalInput[] = [
        { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
        { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
        { categoryKey: 'depreciation', tyyppi: 'poisto', summa: 60000 },
        { categoryKey: 'investments', tyyppi: 'investointi', summa: 40000 },
      ];
      const r1 = engine.computeFromSubtotals(
        2024,
        3,
        shuffled,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      const r2 = engine.computeFromSubtotals(
        2024,
        3,
        ordered,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      for (let i = 0; i < r1.length; i++) {
        expect(r1[i].tulos).toBeCloseTo(r2[i].tulos, 2);
        expect(r1[i].tulotYhteensa).toBeCloseTo(r2[i].tulotYhteensa, 2);
      }
    });

    it('vesihinta and myytyVesimaara populated from drivers', () => {
      const result = engine.computeFromSubtotals(
        2024,
        1,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      // Year 0 water price = volume-weighted combined price.
      // (1.2*12000 + 2.0*9000) / (12000+9000) = 1.542857...
      expect(result[0].vesihinta).toBeCloseTo(1.54, 2);
      // Year 0 total volume = 12000+9000 = 21000
      expect(result[0].myytyVesimaara).toBeCloseTo(21000, 0);
      // Year 1 volumes decrease by 1%
      expect(result[1].myytyVesimaara).toBeCloseTo(21000 * 0.99, 0);
    });

    it('20-year projection produces reasonable trajectory', () => {
      const result = engine.computeFromSubtotals(
        2024,
        20,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(result).toHaveLength(21);
      expect(result[20].vuosi).toBe(2044);
      // After 20 years, costs should have grown significantly
      expect(result[20].kulutYhteensa).toBeGreaterThan(result[0].kulutYhteensa);
      // Water prices should have risen
      expect(result[20].vesihinta).toBeGreaterThan(result[0].vesihinta);
    });

    it('ADR-013: base fee grows with perusmaksuMuutos when drivers have base fee', () => {
      const driversWithBase: RevenueDriverInput[] = [
        {
          palvelutyyppi: 'vesi',
          yksikkohinta: 1,
          myytyMaara: 1000,
          perusmaksu: 10,
          liittymamaara: 100,
        },
        {
          palvelutyyppi: 'jatevesi',
          yksikkohinta: 2,
          myytyMaara: 500,
          perusmaksu: 20,
          liittymamaara: 50,
        },
      ];
      // Base fee year 0 = 10*100 + 20*50 = 1000 + 1000 = 2000
      const assumptions = { ...DEFAULT_ASSUMPTIONS, perusmaksuMuutos: 0.02 };
      const result = engine.computeFromSubtotals(
        2024,
        2,
        [],
        driversWithBase,
        assumptions,
      );
      const rev0 = result[0].tulotYhteensa;
      const rev1 = result[1].tulotYhteensa;
      const rev2 = result[2].tulotYhteensa;
      // Volume revenue grows with hintakorotus/vesimaaran_muutos; base fee grows 2% per year
      // Year 1 base fee = 2000 * 1.02 = 2040; year 2 = 2000 * 1.02^2
      expect(rev1).toBeGreaterThan(rev0);
      expect(rev2).toBeGreaterThan(rev1);
      // Base fee year 2 should be 2000 * 1.02^2 = 2080.8
      const baseFeeY2 = 2000 * 1.02 * 1.02;
      const volumeRevY2 =
        1 * 1.03 * 1.03 * 1000 * 0.99 * 0.99 +
        2 * 1.03 * 1.03 * 500 * 0.99 * 0.99;
      expect(result[2].tulotYhteensa).toBeCloseTo(volumeRevY2 + baseFeeY2, -1); // tolerance 10
    });

    it('ADR-013: baseFeeOverrides replaces computed base fee for given year', () => {
      const driversWithBase: RevenueDriverInput[] = [
        {
          palvelutyyppi: 'vesi',
          yksikkohinta: 1,
          myytyMaara: 1000,
          perusmaksu: 10,
          liittymamaara: 100,
        },
      ];
      const overrides: Record<number, number> = { 2025: 3000 };
      const result = engine.computeFromSubtotals(
        2024,
        1,
        [],
        driversWithBase,
        DEFAULT_ASSUMPTIONS,
        overrides,
      );
      // Year 2024: volume revenue = 1*1000 = 1000, base fee = 10*100 = 1000
      expect(result[0].tulotYhteensa).toBeCloseTo(1000 + 1000, 0);
      // Year 2025: override 3000 instead of 1000 * (1+0)^1 = 1000
      const volRev2025 = 1 * 1.03 * 1000 * 0.99;
      expect(result[1].tulotYhteensa).toBeCloseTo(volRev2025 + 3000, 0);
    });

    it('kassafloede = tulos − investoinnit per year', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      for (const yr of result) {
        const expected = yr.tulos - yr.investoinnitYhteensa;
        expect(yr.kassafloede).toBeCloseTo(expected, 2);
      }
    });

    it('ackumuleradKassa is running sum of kassafloede', () => {
      const result = engine.computeFromSubtotals(
        2024,
        3,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      let running = 0;
      for (const yr of result) {
        running += yr.kassafloede;
        expect(yr.ackumuleradKassa).toBeCloseTo(running, 2);
      }
    });
  });

  describe('computeRequiredTariff', () => {
    const SUBTOTALS: SubtotalInput[] = [
      { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
      { categoryKey: 'other_costs', tyyppi: 'kulu', summa: 50000 },
      { categoryKey: 'depreciation', tyyppi: 'poisto', summa: 40000 },
      { categoryKey: 'financial_costs', tyyppi: 'rahoitus_kulu', summa: 5000 },
      { categoryKey: 'investments', tyyppi: 'investointi', summa: 30000 },
    ];
    const DRIVERS: RevenueDriverInput[] = [
      {
        palvelutyyppi: 'vesi',
        yksikkohinta: 1.5,
        myytyMaara: 50000,
        perusmaksu: 0,
        liittymamaara: 0,
      },
      {
        palvelutyyppi: 'jatevesi',
        yksikkohinta: 2.0,
        myytyMaara: 40000,
        perusmaksu: 0,
        liittymamaara: 0,
      },
    ];
    const DEFAULT_ASSUMPTIONS: AssumptionMap = {
      inflaatio: 0.025,
      energiakerroin: 0.05,
      vesimaaran_muutos: -0.01,
      hintakorotus: 0.03,
      investointikerroin: 0.02,
    };

    it('returns expected tariff for known inputs (sanity)', () => {
      const P = engine.computeRequiredTariff(
        2024,
        10,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).not.toBeNull();
      expect(typeof P).toBe('number');
      expect(P).toBeGreaterThanOrEqual(0);
      expect(P).toBeLessThanOrEqual(100);
      expect(Number((P as number).toFixed(2))).toBe(P); // 2 decimals
    });

    it('returns null when volume is zero', () => {
      const zeroVolume: RevenueDriverInput[] = [
        {
          palvelutyyppi: 'vesi',
          yksikkohinta: 1,
          myytyMaara: 0,
          perusmaksu: 0,
          liittymamaara: 0,
        },
        {
          palvelutyyppi: 'jatevesi',
          yksikkohinta: 2,
          myytyMaara: 0,
          perusmaksu: 0,
          liittymamaara: 0,
        },
      ];
      const P = engine.computeRequiredTariff(
        2024,
        5,
        SUBTOTALS,
        zeroVolume,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).toBeNull();
    });

    it('returns null when infeasible (costs exceed max revenue at P_MAX)', () => {
      const hugeCosts: SubtotalInput[] = [
        { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 10_000_000 },
        { categoryKey: 'other_costs', tyyppi: 'kulu', summa: 5_000_000 },
        { categoryKey: 'depreciation', tyyppi: 'poisto', summa: 2_000_000 },
        { categoryKey: 'investments', tyyppi: 'investointi', summa: 1_000_000 },
      ];
      const smallVolume: RevenueDriverInput[] = [
        {
          palvelutyyppi: 'vesi',
          yksikkohinta: 1,
          myytyMaara: 100,
          perusmaksu: 0,
          liittymamaara: 0,
        },
      ];
      const P = engine.computeRequiredTariff(
        2024,
        5,
        hugeCosts,
        smallVolume,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).toBeNull();
    });

    it('base fee is included in otherIncome; required tariff solves for volume price only', () => {
      const driversWithBase: RevenueDriverInput[] = [
        {
          palvelutyyppi: 'vesi',
          yksikkohinta: 1,
          myytyMaara: 20000,
          perusmaksu: 50,
          liittymamaara: 500,
        },
      ];
      const P = engine.computeRequiredTariff(
        2024,
        5,
        SUBTOTALS,
        driversWithBase,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).not.toBeNull();
      expect(P).toBeGreaterThanOrEqual(0);
    });

    it('computes tariff that makes first forecast-year result non-negative', () => {
      const P = engine.computeRequiredTariffForAnnualResultZero(
        2024,
        5,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).not.toBeNull();

      const values: Record<number, number> = {};
      for (let year = 2024; year <= 2029; year += 1) {
        values[year] = P as number;
      }

      const years = engine.computeFromSubtotals(
        2024,
        5,
        SUBTOTALS,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        {
          vesi: { yksikkohinta: { mode: 'manual', values } },
          jatevesi: { yksikkohinta: { mode: 'manual', values } },
        },
      );
      expect(years[0].tulos).toBeGreaterThanOrEqual(-1);
    });

    it('returns zero annual-result tariff when first-year result is already non-negative at P=0', () => {
      const noCostSubtotals: SubtotalInput[] = [
        {
          categoryKey: 'rahoitustuotot_ja_kulut',
          tyyppi: 'rahoitus_tulo',
          summa: 100000,
        },
      ];
      const P = engine.computeRequiredTariffForAnnualResultZero(
        2024,
        5,
        noCostSubtotals,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
      );
      expect(P).toBe(0);
    });
  });

  describe('driver override paths', () => {
    const LINES = [
      {
        tiliryhma: '4100',
        nimi: 'Energi',
        tyyppi: 'kulu' as const,
        summa: 10000,
      },
    ];

    it('uses manual per-year overrides for unit prices', () => {
      const driverPaths: DriverPaths = {
        vesi: {
          yksikkohinta: { mode: 'manual', values: { 2024: 1.5, 2025: 1.7 } },
        },
      };
      const result = engine.compute(
        2024,
        1,
        LINES,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        driverPaths,
      );
      const year2025 = result.find((y) => y.vuosi === 2025)!;
      const waterDriver = year2025.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'vesi',
      )!;
      expect(waterDriver.yksikkohinta).toBeCloseTo(1.7, 3);
    });

    it('applies percent plans from the selected base year', () => {
      const driverPaths: DriverPaths = {
        jatevesi: {
          myytyMaara: {
            mode: 'percent',
            baseYear: 2024,
            baseValue: 9000,
            annualPercent: 0.05,
          },
        },
      };
      const result = engine.compute(
        2024,
        2,
        LINES,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        driverPaths,
      );
      const year2026 = result.find((y) => y.vuosi === 2026)!;
      const wastewaterDriver = year2026.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'jatevesi',
      )!;
      const expected = 9000 * Math.pow(1.05, 2);
      expect(wastewaterDriver.myytyMaara).toBeCloseTo(expected, 2);
    });

    it('applies percent plans symmetrically around base year (backward + forward)', () => {
      const driverPaths: DriverPaths = {
        vesi: {
          yksikkohinta: {
            mode: 'percent',
            baseYear: 2026,
            baseValue: 2.0,
            annualPercent: 0.1,
          },
        },
      };
      const result = engine.compute(
        2024,
        2,
        LINES,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        driverPaths,
      );
      const year2024 = result.find((y) => y.vuosi === 2024)!;
      const year2025 = result.find((y) => y.vuosi === 2025)!;
      const year2026 = result.find((y) => y.vuosi === 2026)!;

      const d2024 = year2024.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'vesi',
      )!;
      const d2025 = year2025.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'vesi',
      )!;
      const d2026 = year2026.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'vesi',
      )!;

      expect(d2026.yksikkohinta).toBeCloseTo(2.0, 2);
      expect(d2025.yksikkohinta).toBeCloseTo(2.0 / 1.1, 2);
      expect(d2024.yksikkohinta).toBeCloseTo(2.0 / Math.pow(1.1, 2), 2);
    });

    it('prefers manual values over percent plan for matching years', () => {
      const driverPaths: DriverPaths = {
        jatevesi: {
          myytyMaara: {
            mode: 'percent',
            baseYear: 2024,
            baseValue: 9000,
            annualPercent: 0.02,
            values: { 2025: 9500 },
          },
        },
      };
      const result = engine.compute(
        2024,
        2,
        LINES,
        DRIVERS,
        DEFAULT_ASSUMPTIONS,
        undefined,
        driverPaths,
      );
      const year2025 = result.find((y) => y.vuosi === 2025)!;
      const year2026 = result.find((y) => y.vuosi === 2026)!;
      const driver2025 = year2025.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'jatevesi',
      )!;
      const driver2026 = year2026.erittelyt.ajurit.find(
        (d) => d.palvelutyyppi === 'jatevesi',
      )!;
      expect(driver2025.myytyMaara).toBeCloseTo(9500, 3);
      const expected2026 = 9000 * Math.pow(1.02, 2);
      expect(driver2026.myytyMaara).toBeCloseTo(expected2026, 2);
    });
  });

  describe('PDF export content marker (regression)', () => {
    it('exportPdf returns valid PDF buffer (structure marker)', async () => {
      const projectionWithYears = {
        id: 'p1',
        orgId: 'org1',
        vuodet: [
          {
            vuosi: 2024,
            tulotYhteensa: 100,
            kulutYhteensa: 80,
            investoinnitYhteensa: 10,
            tulos: 10,
            kumulatiivinenTulos: 10,
          },
        ],
      };
      const mockRepo = {
        findById: jest.fn().mockResolvedValue(projectionWithYears),
      };
      const { PrismaService } = require('../prisma/prisma.service');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProjectionsService,
          ProjectionEngine,
          { provide: ProjectionsRepository, useValue: mockRepo },
          { provide: PrismaService, useValue: {} },
        ],
      }).compile();
      const service = module.get(ProjectionsService);
      const buf = await service.exportPdf('org1', 'p1');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(500);
      const content = buf.toString('latin1');
      expect(content).toMatch(/%PDF-1\.\d/);
      expect(content).toContain('%%EOF');
      expect(content).toContain('Ennusteraportti');
      expect(content).toContain('Yhd. hinta');
    });

    it('writes sample PDF artifact when WRITE_SAMPLE_PDF=1', async () => {
      if (process.env.WRITE_SAMPLE_PDF !== '1') return;
      const projectionWithYears = {
        id: 'p1',
        orgId: 'org1',
        vuodet: [
          {
            vuosi: 2024,
            tulotYhteensa: 100,
            kulutYhteensa: 80,
            investoinnitYhteensa: 10,
            tulos: 10,
            kumulatiivinenTulos: 10,
          },
          {
            vuosi: 2025,
            tulotYhteensa: 110,
            kulutYhteensa: 85,
            investoinnitYhteensa: 5,
            tulos: 20,
            kumulatiivinenTulos: 30,
          },
        ],
      };
      const mockRepo = {
        findById: jest.fn().mockResolvedValue(projectionWithYears),
      };
      const { PrismaService } = require('../prisma/prisma.service');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProjectionsService,
          ProjectionEngine,
          { provide: ProjectionsRepository, useValue: mockRepo },
          { provide: PrismaService, useValue: {} },
        ],
      }).compile();
      const service = module.get(ProjectionsService);
      const buf = await service.exportPdf('org1', 'p1');
      const outDir = path.join(__dirname, '..', '..', 'sample-output');
      fs.mkdirSync(outDir, { recursive: true });
      const artifactPath = path.join(outDir, 'sample-cashflow.pdf');
      fs.writeFileSync(artifactPath, buf);
      expect(buf.length).toBeGreaterThan(500);
    });
  });
});
