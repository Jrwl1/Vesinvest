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

  it('uses exact Y-tunnus lookup before the broader catalog scan', async () => {
    const service = new VeetiService();
    const fetchEntity = jest
      .fn()
      .mockResolvedValueOnce([
        {
          Id: 1535,
          Nimi: 'Water Utility',
          YTunnus: '1234567-8',
          Kunta: 'Helsinki',
        },
      ]);
    (service as any).fetchEntity = fetchEntity;

    const result = await service.searchOrganizations('1234567-8', 10);

    expect(fetchEntity).toHaveBeenCalledTimes(1);
    expect(fetchEntity).toHaveBeenCalledWith(
      'VesihuoltoOrganisaatio',
      expect.objectContaining({
        $filter: "YTunnus eq '1234567-8'",
        $top: '10',
      }),
    );
    expect(result).toEqual([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ]);
  });

  it('uses exact VEETI id lookup before the broader catalog scan for numeric queries', async () => {
    const service = new VeetiService();
    const fetchEntity = jest.fn().mockResolvedValueOnce([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ]);
    (service as any).fetchEntity = fetchEntity;

    const result = await service.searchOrganizations('1535', 10);

    expect(fetchEntity).toHaveBeenCalledTimes(1);
    expect(fetchEntity).toHaveBeenCalledWith(
      'VesihuoltoOrganisaatio',
      expect.objectContaining({
        $filter: 'Id eq 1535',
        $top: '1',
      }),
    );
    expect(result).toEqual([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ]);
  });

  it('reuses the cached organization catalog across repeated text searches', async () => {
    const service = new VeetiService();
    const fetchEntity = jest.fn().mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
      {
        Id: 2001,
        Nimi: 'Wastewater Utility',
        YTunnus: '7654321-0',
        Kunta: 'Espoo',
      },
    ]);
    (service as any).fetchEntity = fetchEntity;

    const first = await service.searchOrganizations('Water', 10);
    const second = await service.searchOrganizations('Waste', 10);

    expect(fetchEntity).toHaveBeenCalledTimes(1);
    expect(fetchEntity).toHaveBeenCalledWith(
      'VesihuoltoOrganisaatio',
      expect.objectContaining({
        $top: '500',
        $skip: '0',
        $orderby: 'Nimi asc',
      }),
    );
    expect(first).toEqual([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
      {
        Id: 2001,
        Nimi: 'Wastewater Utility',
        YTunnus: '7654321-0',
        Kunta: 'Espoo',
      },
    ]);
    expect(second).toEqual([
      {
        Id: 2001,
        Nimi: 'Wastewater Utility',
        YTunnus: '7654321-0',
        Kunta: 'Espoo',
      },
    ]);
  });
});
