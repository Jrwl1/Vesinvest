import { VeetiEffectiveDataService } from './veeti-effective-data.service';

describe('VeetiEffectiveDataService', () => {
  it('falls back to static verkko rows when year-specific rows are missing', async () => {
    const prisma: any = {
      veetiSnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            vuosi: 0,
            rawData: [
              { Id: 3068, Tyyppi_Id: 1 },
              { Id: 4131, Tyyppi_Id: 2 },
            ],
          },
        ]),
      },
      veetiOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      veetiYearPolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new VeetiEffectiveDataService(prisma);
    const result = await service.getEffectiveRowsForVeetiId(
      'org-1',
      1535,
      2024,
      'verkko',
    );

    expect(result.source).toBe('veeti');
    expect(result.rows).toHaveLength(2);
    expect(result.hasRawSnapshot).toBe(true);
    expect(prisma.veetiSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vuosi: { in: [2024, 0] } }),
      }),
    );
  });

  it('keeps static bucket out of year list while exposing static dataset counts', async () => {
    const prisma: any = {
      veetiOrganisaatio: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ orgId: 'org-1', veetiId: 1535 }),
      },
      veetiSnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            vuosi: 0,
            dataType: 'verkko',
            rawData: [{ Id: 3068 }, { Id: 4131 }, { Id: 4155 }],
          },
          {
            vuosi: 2024,
            dataType: 'tilinpaatos',
            rawData: [{ Vuosi: 2024, Liikevaihto: 507527 }],
          },
        ]),
      },
      veetiOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      veetiYearPolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new VeetiEffectiveDataService(prisma);
    const years = await service.getAvailableYears('org-1');

    expect(years.map((row) => row.vuosi)).toEqual([2024]);
    expect(years[0]?.datasetCounts.verkko).toBe(3);
    expect(years[0]?.completeness.verkko).toBe(true);
  });
});
