import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { VeetiImportService } from './veeti-import.service';

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function jsonResponse(payload: unknown): MockResponse {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

describe('VeetiImportService', () => {
  let service: VeetiImportService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new VeetiImportService();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('aggregates VEETI prices and volumes by year', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/VesihuoltoOrganisaatio?')) {
        return jsonResponse({ value: [{ Id: 1535, Nimi: 'Kronoby vatten och avlopp ab', YTunnus: '0180030-9' }] });
      }
      if (url.includes('/TaksaKayttomaksu?')) {
        return jsonResponse({
          value: [
            { Vuosi: 2023, Tyyppi_Id: 1, Kayttomaksu: '1.30' },
            { Vuosi: 2023, Tyyppi_Id: 2, Kayttomaksu: '2.60' },
            { Vuosi: 2024, Tyyppi_Id: 1, Kayttomaksu: '1.50' },
            { Vuosi: 2024, Tyyppi_Id: 2, Kayttomaksu: '2.80' },
          ],
        });
      }
      if (url.includes('/LaskutettuTalousvesi?')) {
        return jsonResponse({
          value: [
            { Vuosi: 2023, Maara: 100000 },
            { Vuosi: 2023, Maara: 5000 },
            { Vuosi: 2024, Maara: 174460 },
          ],
        });
      }
      if (url.includes('/LaskutettuJatevesi?')) {
        return jsonResponse({
          value: [
            { Vuosi: 2023, Maara: 94134 },
            { Vuosi: 2024, Maara: 99901 },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.fetchDrivers(1535, [2024, 2023, 2024]);

    expect(result.years).toEqual([2023, 2024]);
    expect(result.org.id).toBe(1535);
    expect(result.driversByYear[2023]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ palvelutyyppi: 'vesi', yksikkohinta: 1.3, myytyMaara: 105000 }),
        expect.objectContaining({ palvelutyyppi: 'jatevesi', yksikkohinta: 2.6, myytyMaara: 94134 }),
      ]),
    );
    expect(result.driversByYear[2024]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ palvelutyyppi: 'vesi', yksikkohinta: 1.5, myytyMaara: 174460 }),
        expect.objectContaining({ palvelutyyppi: 'jatevesi', yksikkohinta: 2.8, myytyMaara: 99901 }),
      ]),
    );
    expect(result.missingByYear[2023]).toEqual([]);
    expect(result.missingByYear[2024]).toEqual([]);
  });

  it('reports missing fields when VEETI data is partial', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/VesihuoltoOrganisaatio?')) {
        return jsonResponse({ value: [{ Id: 1535, Nimi: 'Kronoby', YTunnus: '0180030-9' }] });
      }
      if (url.includes('/TaksaKayttomaksu?')) {
        return jsonResponse({ value: [{ Vuosi: 2025, Tyyppi_Id: 1, Kayttomaksu: '1.50' }] });
      }
      if (url.includes('/LaskutettuTalousvesi?')) {
        return jsonResponse({ value: [] });
      }
      if (url.includes('/LaskutettuJatevesi?')) {
        return jsonResponse({ value: [] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.fetchDrivers(1535, [2025]);

    expect(result.missingByYear[2025]).toEqual([
      'vesi.myytyMaara',
      'jatevesi.yksikkohinta',
      'jatevesi.myytyMaara',
    ]);
  });

  it('throws BadRequest for invalid input', async () => {
    await expect(service.fetchDrivers(0, [2024])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.fetchDrivers(1535, [])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadGateway when VEETI upstream returns failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => 'Service unavailable',
    });

    await expect(service.fetchDrivers(1535, [2024])).rejects.toBeInstanceOf(BadGatewayException);
  });
});

