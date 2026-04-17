import { VeetiBudgetGenerator } from './veeti-budget-generator';

describe('VeetiBudgetGenerator', () => {
  const prisma: any = {};
  const veetiService = {
    toNumber: (value: unknown) => {
      if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    },
  };
  const veetiEffectiveDataService: any = {
    getEffectiveRows: async () => ({ rows: [] }),
  };

  const generator = new VeetiBudgetGenerator(
    prisma,
    veetiService as any,
    veetiEffectiveDataService,
  );

  it('maps Tilinpaatos fields to valisummat', () => {
    const rows = generator.mapTilinpaatosToValisummat({
      Liikevaihto: 1000,
      Henkilostokulut: 200,
      Poistot: 50,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryKey: 'liikevaihto',
          tyyppi: 'tulo',
          summa: 1000,
        }),
        expect.objectContaining({
          categoryKey: 'personnel_costs',
          tyyppi: 'kulu',
          summa: 200,
        }),
        expect.objectContaining({
          categoryKey: 'poistot',
          tyyppi: 'poisto',
          summa: 50,
        }),
      ]),
    );
  });

  it('keeps AineetJaPalvelut empty and leaves LiiketoiminnanMuutKulut direct when materials data is missing', () => {
    const rows = generator.mapTilinpaatosToValisummat({
      LiiketoiminnanMuutKulut: 100,
    });

    const materials = rows.find(
      (row) => row.categoryKey === 'materials_services',
    );
    const other = rows.find((row) => row.categoryKey === 'other_costs');

    expect(materials?.summa).toBe(0);
    expect(other?.summa).toBe(100);
  });

  it('maps direct AineetJaPalvelut and Poistot rows without inventing fallback splits', () => {
    const rows = generator.mapTilinpaatosToValisummat({
      Liikevaihto: 1000,
      AineetJaPalvelut: 120,
      Henkilostokulut: 200,
      Poistot: 50,
      LiiketoiminnanMuutKulut: 80,
      TilikaudenYliJaama: 550,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryKey: 'materials_services',
          summa: 120,
        }),
        expect.objectContaining({
          categoryKey: 'poistot',
          summa: 50,
        }),
        expect.objectContaining({
          categoryKey: 'other_costs',
          summa: 80,
        }),
      ]),
    );
  });

  it('flips financial type to rahoitus_kulu when combined field is negative', () => {
    const rows = generator.mapTilinpaatosToValisummat({
      RahoitustuototJaKulut: -45,
    });

    const financial = rows.find(
      (row) => row.categoryKey === 'rahoitustuotot_ja_kulut',
    );
    expect(financial).toEqual(
      expect.objectContaining({
        categoryKey: 'rahoitustuotot_ja_kulut',
        tyyppi: 'rahoitus_kulu',
        summa: 45,
      }),
    );
  });

  it('reports fallback-to-zero metadata for missing source fields', async () => {
    const effectiveRowsByType: Record<
      string,
      Array<Record<string, unknown>>
    > = {
      tilinpaatos: [
        { Vuosi: 2024, Liikevaihto: 500000, TilikaudenYliJaama: 12000 },
      ],
      taksa: [{ Vuosi: 2024, Tyyppi_Id: 1, Kayttomaksu: 1.5 }],
      volume_vesi: [{ Vuosi: 2024, Maara: 174460 }],
      volume_jatevesi: [],
      investointi: [],
    };
    const customEffective = {
      getEffectiveRows: jest.fn(
        async (_orgId: string, _year: number, dataType: string) => ({
          rows: effectiveRowsByType[dataType] ?? [],
        }),
      ),
    };
    const customGenerator = new VeetiBudgetGenerator(
      prisma,
      veetiService as any,
      customEffective as any,
    );

    const preview = await customGenerator.previewBudget('org-1', 2024);

    expect(preview.completeness.fallbackToZero.count).toBeGreaterThan(0);
    expect(preview.completeness.fallbackToZero.fields).toEqual(
      expect.arrayContaining([
        'tilinpaatos.Henkilostokulut',
        'taksa.wastewater.Kayttomaksu',
        'volume_jatevesi.Maara',
      ]),
    );
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        'Missing source values defaulted to 0 for calculations.',
      ]),
    );
  });

  it('keeps fixed revenue in preview completeness when tariff revenue reconciles', async () => {
    const effectiveRowsByType: Record<
      string,
      Array<Record<string, unknown>>
    > = {
      tilinpaatos: [
        {
          Vuosi: 2024,
          Liikevaihto: 430000,
          PerusmaksuYhteensa: 10000,
          Henkilostokulut: 120000,
        },
      ],
      taksa: [
        { Vuosi: 2024, Tyyppi_Id: 1, Kayttomaksu: 2 },
        { Vuosi: 2024, Tyyppi_Id: 2, Kayttomaksu: 2.2 },
      ],
      volume_vesi: [{ Vuosi: 2024, Maara: 100000 }],
      volume_jatevesi: [{ Vuosi: 2024, Maara: 100000 }],
      investointi: [],
    };
    const customEffective = {
      getEffectiveRows: jest.fn(
        async (_orgId: string, _year: number, dataType: string) => ({
          rows: effectiveRowsByType[dataType] ?? [],
        }),
      ),
    };
    const customGenerator = new VeetiBudgetGenerator(
      prisma,
      veetiService as any,
      customEffective as any,
    );

    const preview = await customGenerator.previewBudget('org-1', 2024);

    expect(preview.perusmaksuYhteensa).toBe(10000);
    expect(preview.completeness.required.tariffRevenueStructure).toBe(true);
    expect(preview.missing.tariffRevenueStructure).toBe(false);
  });

  it('derives TilikaudenYliJaama for baseline payloads when the source row is missing it', async () => {
    const effectiveRowsByType: Record<
      string,
      Array<Record<string, unknown>>
    > = {
      tilinpaatos: [
        {
          Vuosi: 2024,
          Liikevaihto: 100000,
          AineetJaPalvelut: 15000,
          Henkilostokulut: 20000,
          LiiketoiminnanMuutKulut: 18000,
          Poistot: 5000,
          TilikaudenYliJaama: null,
        },
      ],
      taksa: [{ Vuosi: 2024, Tyyppi_Id: 1, Kayttomaksu: 1.5 }],
      volume_vesi: [{ Vuosi: 2024, Maara: 174460 }],
      volume_jatevesi: [],
      investointi: [],
    };
    const customEffective = {
      getEffectiveRows: jest.fn(
        async (_orgId: string, _year: number, dataType: string) => ({
          rows: effectiveRowsByType[dataType] ?? [],
        }),
      ),
    };
    const customGenerator = new VeetiBudgetGenerator(
      prisma,
      veetiService as any,
      customEffective as any,
    );

    const preview = await customGenerator.previewBudget('org-1', 2024);
    const resultRow = preview.valisummat.find(
      (row) => row.categoryKey === 'tilikauden_tulos',
    );

    expect(resultRow?.summa).toBe(42000);
    expect(
      preview.completeness.fallbackToZero.fields,
    ).not.toContain('tilinpaatos.TilikaudenYliJaama');
  });

  it('does not skip baseline generation when tariff revenue structure is only a warning', async () => {
    const prismaMock: any = {
      talousarvio: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'budget-2024' }),
        update: jest.fn(),
      },
      talousarvioValisumma: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
      tuloajuri: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
    };
    const effectiveRowsByType: Record<
      string,
      Array<Record<string, unknown>>
    > = {
      tilinpaatos: [
        {
          Vuosi: 2024,
          Liikevaihto: 100000,
          PerusmaksuYhteensa: 12000,
          AineetJaPalvelut: 15000,
          Henkilostokulut: 20000,
          LiiketoiminnanMuutKulut: 18000,
          Poistot: 5000,
          TilikaudenYliJaama: 30000,
        },
      ],
      taksa: [
        { Vuosi: 2024, Tyyppi_Id: 1, Kayttomaksu: 2.5 },
        { Vuosi: 2024, Tyyppi_Id: 2, Kayttomaksu: 3.1 },
      ],
      volume_vesi: [{ Vuosi: 2024, Maara: 25000 }],
      volume_jatevesi: [{ Vuosi: 2024, Maara: 24000 }],
      investointi: [],
    };
    const customEffective = {
      getEffectiveRows: jest.fn(
        async (_orgId: string, _year: number, dataType: string) => ({
          rows: effectiveRowsByType[dataType] ?? [],
        }),
      ),
    };
    const customGenerator = new VeetiBudgetGenerator(
      prismaMock,
      veetiService as any,
      customEffective as any,
    );

    const result = await customGenerator.generateBudgets('org-1', [2024]);

    expect(result.count).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(prismaMock.talousarvio.create).toHaveBeenCalled();
  });
});
