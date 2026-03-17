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
});
