import { describe, expect, it } from 'vitest';

import { buildOverviewQdisImportComparisonRows } from './overviewReviewViewModel';

describe('overviewReviewViewModel', () => {
  it('compares QDIS imports against summed VEETI volume rows', () => {
    const rows = buildOverviewQdisImportComparisonRows({
      currentYearData: {
        datasets: [
          {
            dataType: 'taksa',
            rawRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 1.5 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.8 },
            ],
            effectiveRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 1.5 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.8 },
            ],
          },
          {
            dataType: 'volume_vesi',
            rawRows: [{ Maara: '87592' }, { Maara: '134518' }],
            effectiveRows: [{ Maara: '87592' }, { Maara: '134518' }],
          },
          {
            dataType: 'volume_jatevesi',
            rawRows: [{ Maara: '98021' }],
            effectiveRows: [{ Maara: '98021' }],
          },
        ],
      } as any,
      qdisImportPreview: {
        fields: {
          soldWaterVolume: 222110,
          soldWastewaterVolume: 98021,
        },
      },
      labels: {
        waterPrice: 'Water price',
        wastewaterPrice: 'Wastewater price',
        waterVolume: 'Sold water',
        wastewaterVolume: 'Sold wastewater',
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'soldWaterVolume',
          veetiValue: 222110,
          currentValue: 222110,
          changedFromCurrent: false,
        }),
        expect.objectContaining({
          key: 'soldWastewaterVolume',
          veetiValue: 98021,
          currentValue: 98021,
          changedFromCurrent: false,
        }),
      ]),
    );
  });
});
