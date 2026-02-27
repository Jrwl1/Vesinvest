import { VEETI_IMPORT_DATA_TYPES } from './veeti-import-contract';
import { VeetiService } from './veeti.service';

describe('VeetiService', () => {
  it('applies year filter for yearly datasets', async () => {
    const service = new VeetiService();
    const fetchEntity = jest.fn().mockResolvedValue([]);
    (service as any).fetchEntity = fetchEntity;

    await service.fetchEntityByYear(1535, 'tilinpaatos', 2024);

    expect(fetchEntity).toHaveBeenCalledWith(
      'Tilinpaatos',
      expect.objectContaining({
        $filter: 'VesihuoltoOrganisaatio_Id eq 1535 and Vuosi eq 2024',
        $orderby: 'Vuosi asc',
      }),
    );
  });

  it('skips year filter for static datasets', async () => {
    const service = new VeetiService();
    const fetchEntity = jest.fn().mockResolvedValue([]);
    (service as any).fetchEntity = fetchEntity;

    await service.fetchEntityByYear(1535, 'verkko', 2024);

    expect(fetchEntity).toHaveBeenCalledWith(
      'Verkko',
      expect.objectContaining({
        $filter: 'VesihuoltoOrganisaatio_Id eq 1535',
      }),
    );
    expect(fetchEntity.mock.calls[0][1]?.$filter).not.toContain('Vuosi eq');
  });

  it('fetches all contract datasets for organization import', async () => {
    const service = new VeetiService();
    const fetchEntity = jest.fn().mockResolvedValue([]);
    (service as any).fetchEntity = fetchEntity;

    const data = await service.fetchAllOrgData(1535);

    expect(Object.keys(data).sort()).toEqual(
      [...VEETI_IMPORT_DATA_TYPES].sort(),
    );
    expect(fetchEntity).toHaveBeenCalledTimes(VEETI_IMPORT_DATA_TYPES.length);
    expect(
      fetchEntity.mock.calls.map((call: unknown[]) => call[0]).sort(),
    ).toEqual(
      [
        'EnergianKaytto',
        'Investointi',
        'LaskutettuJatevesi',
        'LaskutettuTalousvesi',
        'TaksaKayttomaksu',
        'Tilinpaatos',
        'Verkko',
      ].sort(),
    );
  });
});
