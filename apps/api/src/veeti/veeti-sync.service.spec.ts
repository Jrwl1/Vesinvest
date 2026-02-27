import { VeetiSyncService } from './veeti-sync.service';

describe('VeetiSyncService', () => {
  const service = new VeetiSyncService(
    {} as any,
    {
      extractYear: (row: Record<string, unknown>) => {
        const value = row.Vuosi;
        if (typeof value === 'number' && Number.isInteger(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isInteger(parsed) ? parsed : null;
        }
        return null;
      },
    } as any,
    {} as any,
  );

  it('groups rows by explicit Vuosi', () => {
    const grouped = (service as any).groupRowsByYear([
      { Vuosi: 2023, Id: 1 },
      { Vuosi: '2023', Id: 2 },
      { Vuosi: 2024, Id: 3 },
    ]);

    expect(
      Array.from(grouped.keys() as Iterable<number>).sort((a, b) => a - b),
    ).toEqual([2023, 2024]);
    expect(grouped.get(2023)).toHaveLength(2);
    expect(grouped.get(2024)).toHaveLength(1);
  });

  it('maps yearless rows to static year bucket', () => {
    const row = { Id: 99, Tyyppi_Id: 1 };
    const grouped = (service as any).groupRowsByYear([row], {
      staticYear: 0,
    });

    expect(
      Array.from(grouped.keys() as Iterable<number>).sort((a, b) => a - b),
    ).toEqual([0]);
    expect(grouped.get(0)).toEqual([row]);
  });
});
