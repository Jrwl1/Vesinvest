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
          categoryKey: 'henkilostokulut',
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
});
