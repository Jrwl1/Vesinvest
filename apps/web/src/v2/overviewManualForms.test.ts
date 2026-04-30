import { describe, expect, it } from 'vitest';

import { buildVolumeForm } from './overviewManualForms';

describe('overviewManualForms', () => {
  it('sums all effective VEETI volume rows for year previews and handoff values', () => {
    const form = buildVolumeForm({
      datasets: [
        {
          dataType: 'volume_vesi',
          effectiveRows: [{ Maara: '87592' }, { Maara: '134518' }],
        },
        {
          dataType: 'volume_jatevesi',
          effectiveRows: [{ Maara: '98021' }],
        },
      ],
    } as any);

    expect(form).toEqual({
      soldWaterVolume: 222110,
      soldWastewaterVolume: 98021,
    });
  });
});
