import { VeetiSanityService } from './veeti-sanity.service';

describe('VeetiSanityService', () => {
  it('includes materials and services in operating costs for live and effective summaries', async () => {
    const tilinpaatosRows = [
      {
        Liikevaihto: 100000,
        AineetJaPalvelut: 20000,
        Henkilostokulut: 30000,
        Poistot: 10000,
        LiiketoiminnanMuutKulut: 15000,
        Arvonalentumiset: 0,
        RahoitustuototJaKulut: 0,
        TilikaudenYliJaama: 0,
      },
    ];
    const taksaRows = [
      { Tyyppi_Id: 1, Kayttomaksu: 2.1 },
      { Tyyppi_Id: 2, Kayttomaksu: 3.4 },
    ];
    const waterRows = [{ Maara: 26000 }];
    const wastewaterRows = [{ Maara: 24000 }];

    const veetiService = {
      fetchEntityByYear: jest.fn(
        async (_veetiId: number, dataType: string, _year: number) => {
          if (dataType === 'tilinpaatos') return tilinpaatosRows;
          if (dataType === 'taksa') return taksaRows;
          if (dataType === 'volume_vesi') return waterRows;
          if (dataType === 'volume_jatevesi') return wastewaterRows;
          return [];
        },
      ),
    } as any;

    const veetiEffectiveDataService = {
      getLink: jest.fn().mockResolvedValue({ veetiId: 1535 }),
      getEffectiveRows: jest.fn(
        async (_orgId: string, _year: number, dataType: string) => {
          if (dataType === 'tilinpaatos') return { rows: tilinpaatosRows };
          if (dataType === 'taksa') return { rows: taksaRows };
          if (dataType === 'volume_vesi') return { rows: waterRows };
          if (dataType === 'volume_jatevesi') return { rows: wastewaterRows };
          return { rows: [] };
        },
      ),
    } as any;

    const service = new VeetiSanityService(
      veetiService,
      veetiEffectiveDataService,
    );

    const result = await service.checkYears('org-1', [2024]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      year: 2024,
      status: 'ok',
      mismatches: [],
      expected: {
        revenue: 100000,
        operatingCosts: 75000,
        yearResult: 25000,
        volume: 50000,
      },
      actual: {
        revenue: 100000,
        operatingCosts: 75000,
        yearResult: 25000,
        volume: 50000,
      },
    });
  });
});
