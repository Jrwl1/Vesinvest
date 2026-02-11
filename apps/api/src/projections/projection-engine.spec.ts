import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionEngine, AssumptionMap, RevenueDriverInput, SubtotalInput } from './projection-engine.service';
import { ProjectionsService } from './projections.service';
import { ProjectionsRepository } from './projections.repository';

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
    { palvelutyyppi: 'vesi', yksikkohinta: 1.2, myytyMaara: 12000, perusmaksu: 0, liittymamaara: 0 },
    { palvelutyyppi: 'jatevesi', yksikkohinta: 2.0, myytyMaara: 9000, perusmaksu: 0, liittymamaara: 0 },
  ];

  describe('compute (legacy account-line path)', () => {
    it('produces correct base year and projects forward', () => {
      const lines = [
        { tiliryhma: '4100', nimi: 'Energi', tyyppi: 'kulu' as const, summa: 50000 },
        { tiliryhma: '4200', nimi: 'Personal', tyyppi: 'kulu' as const, summa: 100000 },
        { tiliryhma: '5100', nimi: 'Maskin', tyyppi: 'investointi' as const, summa: 30000 },
      ];

      const result = engine.compute(2024, 3, lines, DRIVERS, DEFAULT_ASSUMPTIONS);
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
      const result = engine.computeFromSubtotals(2024, 5, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      expect(result).toHaveLength(6); // base year + 5 projection years
      expect(result[0].vuosi).toBe(2024);
      expect(result[5].vuosi).toBe(2029);
    });

    it('revenue comes from drivers, not sales_revenue subtotal', () => {
      const result = engine.computeFromSubtotals(2024, 0, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      // Base year: driver revenue = 1.2*12000 + 2.0*9000 = 14400+18000 = 32400
      // Plus connection_fees = 5000, financial_income = 2000
      const expectedBaseRevenue = 32400 + 5000 + 2000;
      expect(result[0].tulotYhteensa).toBeCloseTo(expectedBaseRevenue, 0);
    });

    it('operating costs grow with inflation', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      // Year 0: costs = 100000+50000 = 150000
      // Year 1: costs = 150000 * 1.025 = 153750
      const year0CostSubtotals = result[0].erittelyt.kulut.reduce((s, l) => s + l.summa, 0);
      const year1CostSubtotals = result[1].erittelyt.kulut.reduce((s, l) => s + l.summa, 0);
      expect(year0CostSubtotals).toBeCloseTo(150000, 0);
      expect(year1CostSubtotals).toBeCloseTo(150000 * 1.025, 0);
    });

    it('depreciation is flat (does not grow)', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      // kulutYhteensa includes costs + depreciation + financial costs
      // Depreciation = 60000 in every year (flat)
      // Year 0: kulut = 150000 + 60000 + 5000 = 215000
      expect(result[0].kulutYhteensa).toBeCloseTo(215000, 0);
      // Year 3: kulut includes grown costs + flat depreciation + flat financial costs
      const year3Costs = 150000 * Math.pow(1.025, 3);
      expect(result[3].kulutYhteensa).toBeCloseTo(year3Costs + 60000 + 5000, 0);
    });

    it('S-03: baseline depreciation (poistoPerusta) equals base-year poisto total and is flat across years', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      const baseYearPoistoTotal = 60000; // SUBTOTALS has one poisto: depreciation 60000
      for (let i = 0; i < result.length; i++) {
        expect(result[i].poistoPerusta).toBeCloseTo(baseYearPoistoTotal, 0);
        expect(result[i].poistoInvestoinneista).toBe(0);
      }
    });

    it('S-03: investment-driven depreciation (poistoInvestoinneista) is a separate component from investments', () => {
      const assumptions = { ...DEFAULT_ASSUMPTIONS, investoinninPoistoOsuus: 0.1 };
      const result = engine.computeFromSubtotals(2024, 2, SUBTOTALS, DRIVERS, assumptions);
      // Year 0: investments = 40000, so poistoInvestoinneista = 4000
      expect(result[0].investoinnitYhteensa).toBeCloseTo(40000, 0);
      expect(result[0].poistoInvestoinneista).toBeCloseTo(4000, 0);
      // Year 2: investments = 40000 * 1.02^2
      const invY2 = 40000 * Math.pow(1.02, 2);
      expect(result[2].investoinnitYhteensa).toBeCloseTo(invY2, 0);
      expect(result[2].poistoInvestoinneista).toBeCloseTo(invY2 * 0.1, 0);
      // kulutYhteensa includes both poistoPerusta and poistoInvestoinneista
      expect(result[0].kulutYhteensa).toBeGreaterThanOrEqual(result[0].poistoPerusta + result[0].poistoInvestoinneista);
    });

    it('investments grow with investointikerroin', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      expect(result[0].investoinnitYhteensa).toBeCloseTo(40000, 0);
      expect(result[3].investoinnitYhteensa).toBeCloseTo(40000 * Math.pow(1.02, 3), 0);
    });

    it('financial items are flat', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      // Financial income is in tulotYhteensa, financial costs in kulutYhteensa
      // Both should be flat
      // Year 0 vs year 3: the financial portions should be the same
      // We verify by checking that the difference in kulutYhteensa comes only from cost growth
      const costGrowth = 150000 * (Math.pow(1.025, 3) - 1);
      const kulutDiff = result[3].kulutYhteensa - result[0].kulutYhteensa;
      expect(kulutDiff).toBeCloseTo(costGrowth, 0);
    });

    it('result formula: tulos = revenue - kulut - investments', () => {
      const result = engine.computeFromSubtotals(2024, 0, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      expect(result[0].tulos).toBeCloseTo(
        result[0].tulotYhteensa - result[0].kulutYhteensa - result[0].investoinnitYhteensa,
        2,
      );
    });

    it('cumulative is running sum of tulos', () => {
      const result = engine.computeFromSubtotals(2024, 3, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      let cumSum = 0;
      for (const yr of result) {
        cumSum += yr.tulos;
        expect(yr.kumulatiivinenTulos).toBeCloseTo(cumSum, 1);
      }
    });

    it('works with empty subtotals (drivers only)', () => {
      const result = engine.computeFromSubtotals(2024, 2, [], DRIVERS, DEFAULT_ASSUMPTIONS);
      expect(result).toHaveLength(3);
      expect(result[0].tulotYhteensa).toBeGreaterThan(0);
      expect(result[0].kulutYhteensa).toBe(0);
    });

    it('excludes result-type subtotals from computation', () => {
      const withResult: SubtotalInput[] = [
        ...SUBTOTALS,
        { categoryKey: 'operating_result', tyyppi: 'tulos', summa: 999999 },
      ];
      const result1 = engine.computeFromSubtotals(2024, 0, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      const result2 = engine.computeFromSubtotals(2024, 0, withResult, DRIVERS, DEFAULT_ASSUMPTIONS);
      // Adding a 'tulos' subtotal should not change any numbers
      expect(result1[0].tulos).toBeCloseTo(result2[0].tulos, 2);
    });

    it('driver revenue grows with hintakorotus and vesimaaran_muutos', () => {
      const result = engine.computeFromSubtotals(2024, 1, [], DRIVERS, DEFAULT_ASSUMPTIONS);
      // Year 0: driver revenue = 1.2*12000 + 2.0*9000 = 32400
      // Year 1: price*1.03, volume*0.99
      const y1Price_vesi = 1.2 * 1.03;
      const y1Vol_vesi = 12000 * 0.99;
      const y1Price_jv = 2.0 * 1.03;
      const y1Vol_jv = 9000 * 0.99;
      const expectedY1 = y1Price_vesi * y1Vol_vesi + y1Price_jv * y1Vol_jv;
      expect(result[1].tulotYhteensa).toBeCloseTo(expectedY1, 0);
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
      const r1 = engine.computeFromSubtotals(2024, 3, shuffled, DRIVERS, DEFAULT_ASSUMPTIONS);
      const r2 = engine.computeFromSubtotals(2024, 3, ordered, DRIVERS, DEFAULT_ASSUMPTIONS);
      for (let i = 0; i < r1.length; i++) {
        expect(r1[i].tulos).toBeCloseTo(r2[i].tulos, 2);
        expect(r1[i].tulotYhteensa).toBeCloseTo(r2[i].tulotYhteensa, 2);
      }
    });

    it('vesihinta and myytyVesimaara populated from drivers', () => {
      const result = engine.computeFromSubtotals(2024, 1, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      // Year 0 water price = average of 1.2 and 2.0 = 1.6
      expect(result[0].vesihinta).toBeCloseTo(1.6, 1);
      // Year 0 total volume = 12000+9000 = 21000
      expect(result[0].myytyVesimaara).toBeCloseTo(21000, 0);
      // Year 1 volumes decrease by 1%
      expect(result[1].myytyVesimaara).toBeCloseTo(21000 * 0.99, 0);
    });

    it('20-year projection produces reasonable trajectory', () => {
      const result = engine.computeFromSubtotals(2024, 20, SUBTOTALS, DRIVERS, DEFAULT_ASSUMPTIONS);
      expect(result).toHaveLength(21);
      expect(result[20].vuosi).toBe(2044);
      // After 20 years, costs should have grown significantly
      expect(result[20].kulutYhteensa).toBeGreaterThan(result[0].kulutYhteensa);
      // Water prices should have risen
      expect(result[20].vesihinta).toBeGreaterThan(result[0].vesihinta);
    });

    it('ADR-013: base fee grows with perusmaksuMuutos when drivers have base fee', () => {
      const driversWithBase: RevenueDriverInput[] = [
        { palvelutyyppi: 'vesi', yksikkohinta: 1, myytyMaara: 1000, perusmaksu: 10, liittymamaara: 100 },
        { palvelutyyppi: 'jatevesi', yksikkohinta: 2, myytyMaara: 500, perusmaksu: 20, liittymamaara: 50 },
      ];
      // Base fee year 0 = 10*100 + 20*50 = 1000 + 1000 = 2000
      const assumptions = { ...DEFAULT_ASSUMPTIONS, perusmaksuMuutos: 0.02 };
      const result = engine.computeFromSubtotals(2024, 2, [], driversWithBase, assumptions);
      const rev0 = result[0].tulotYhteensa;
      const rev1 = result[1].tulotYhteensa;
      const rev2 = result[2].tulotYhteensa;
      // Volume revenue grows with hintakorotus/vesimaaran_muutos; base fee grows 2% per year
      // Year 1 base fee = 2000 * 1.02 = 2040; year 2 = 2000 * 1.02^2
      expect(rev1).toBeGreaterThan(rev0);
      expect(rev2).toBeGreaterThan(rev1);
      // Base fee year 2 should be 2000 * 1.02^2 = 2080.8
      const baseFeeY2 = 2000 * 1.02 * 1.02;
      const volumeRevY2 = 1 * 1.03 * 1.03 * 1000 * 0.99 * 0.99 + 2 * 1.03 * 1.03 * 500 * 0.99 * 0.99;
      expect(result[2].tulotYhteensa).toBeCloseTo(volumeRevY2 + baseFeeY2, 0);
    });

    it('ADR-013: baseFeeOverrides replaces computed base fee for given year', () => {
      const driversWithBase: RevenueDriverInput[] = [
        { palvelutyyppi: 'vesi', yksikkohinta: 1, myytyMaara: 1000, perusmaksu: 10, liittymamaara: 100 },
      ];
      const overrides: Record<number, number> = { 2025: 3000 };
      const result = engine.computeFromSubtotals(2024, 1, [], driversWithBase, DEFAULT_ASSUMPTIONS, overrides);
      // Year 2024: volume revenue = 1*1000 = 1000, base fee = 10*100 = 1000
      expect(result[0].tulotYhteensa).toBeCloseTo(1000 + 1000, 0);
      // Year 2025: override 3000 instead of 1000 * (1+0)^1 = 1000
      const volRev2025 = 1 * 1.03 * 1000 * 0.99;
      expect(result[1].tulotYhteensa).toBeCloseTo(volRev2025 + 3000, 0);
    });
  });

  describe('PDF export content marker (regression)', () => {
    it('exportPdf returns valid PDF buffer (structure marker)', async () => {
      const projectionWithYears = {
        id: 'p1',
        orgId: 'org1',
        vuodet: [
          { vuosi: 2024, tulotYhteensa: 100, kulutYhteensa: 80, investoinnitYhteensa: 10, tulos: 10, kumulatiivinenTulos: 10 },
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
      // Title "V1 Cashflow Report" lives in compressed streams; PDF header/footer is the regression marker
    });
  });
});
