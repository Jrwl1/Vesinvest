import { describe, expect, it } from 'vitest';
import {
  buildStatementOcrComparisonRows,
  normalizeStatementOcrFieldValue,
  parseStatementText,
} from './statementOcrParse';

const OCR_SAMPLE = `
OMSÄTTNING 786 930,85 #09 973,89
Övriga rörelsalntäkter ont 2844.28 + 66,24
Materlal och tjänster
- Material, förhödanheter ochvargi — ”
Inköp under fäkenskapsporloden -54 625,78 -32 441 44
"Ökning (+) utter minskning (+) 4v lager 13 835,82 -40689.96 937129 —-23 070,15
Parsöonalkostnader
Löner och arvoden -199 240,13 -194 705,17
*". sPensionakosthader -20 401,70 -30 085,80
"37 Övrigé RreBikostnader -8858,88 -235 498,71 -9 728,29 -234 519,26
Avskrivningar och nedskrivningar
"Avskrivningar enligt plan -186 904,08 -186 217,59
Övriga rörstågkostnader -322 785.53 -353 461,82
RÖRELSEVINST (-FÖRLUST) 13 896,65 -87 328,69
Finansiella intäkter och kostnader
Övriga räntelnläkter och finansiella intäkter
Från övriga 8 064,45 6 251,40
Rantekastnader och övriga finansislla kostnader
Till övriga -18 289,75 10 205,30 217 267.73 — -11 016,33
VINST (-FÖRLUST) FÖRE BOKSLUTS-
DISPOSITIONER OCH SKATTER 3 691,35 -98 345,02
RÄKENSKAPSPERIODENS VINST (-FÖRLUST) 3 691,35 +98 373,45
`;

const DIRECT_TEXT_SAMPLE = `
OMSATTNING 786 930,85 809 973,89
PERSONALKOSTNADER -235 498,71 -234 519,26
AVSKRIVNINGAR ENLIGT PLAN -186 904,08 -186 217,59
OVRIGA RORELSEKOSTNADER -322 785,53 -353 461,82
FINANSIELLA INTAKTER OCH KOSTNADER -10 225,30 -11 016,33
RAKENSKAPSPERIODENS VINST 3 691,35 -98 373,45
`;

const NOISY_LAYOUT_SAMPLE = `
Omsattning 512 345,67 498 001,20
Parsonalkostnader
Parsonalkostnader -142 500,00 -139 400,00
Loner och arvoden -120 000,00 -118 000,00
Pensionakosthader -18 000,00 -17 500,00
Sociala avgifter -4 500,00 -3 900,00
Avskrivningar och nedskrivningar
Avskrivningar enligt plan -75 000,00 -72 500,00
Ovriga rorstagkostnader -210 000,00 -205 500,00
Finansiella intakter och kostnader
Ovriga ranteintakter 1 200,00 900,00
Rantekostnader -7 800,00 -6 900,00
Rakenskapsperiodens vinst 23 045,67 11 601,20
`;

describe('statementOcr parser', () => {
  it('maps the bookkeeping OCR sample into normalized financial fields', () => {
    const result = parseStatementText(OCR_SAMPLE, 4);

    expect(result.fields).toMatchObject({
      liikevaihto: 786930.85,
      henkilostokulut: -235498.71,
      liiketoiminnanMuutKulut: -322785.53,
      poistot: -186904.08,
      rahoitustuototJaKulut: -10225.3,
      tilikaudenYliJaama: 3691.35,
    });
    expect(result.warnings).toEqual([]);
  });

  it('maps a clean direct-text result statement export', () => {
    const result = parseStatementText(DIRECT_TEXT_SAMPLE, 4);

    expect(result.fields).toMatchObject({
      liikevaihto: 786930.85,
      henkilostokulut: -235498.71,
      liiketoiminnanMuutKulut: -322785.53,
      poistot: -186904.08,
      rahoitustuototJaKulut: -10225.3,
      tilikaudenYliJaama: 3691.35,
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps mapping when OCR drifts across labels and finance rows', () => {
    const result = parseStatementText(NOISY_LAYOUT_SAMPLE, 6);

    expect(result.fields).toMatchObject({
      liikevaihto: 512345.67,
      henkilostokulut: -142500,
      liiketoiminnanMuutKulut: -210000,
      poistot: -75000,
      rahoitustuototJaKulut: -6600,
      tilikaudenYliJaama: 23045.67,
    });
    expect(result.warnings).toEqual([]);
  });

  it('normalizes expense rows and compares VEETI, PDF, and current values in one preview model', () => {
    const rows = buildStatementOcrComparisonRows({
      fields: {
        liikevaihto: 786930.85,
        henkilostokulut: -235498.71,
        poistot: -186904.08,
        tilikaudenYliJaama: 3691.35,
      },
      matches: [
        {
          key: 'liikevaihto',
          label: 'Revenue',
          value: 786930.85,
          sourceLine: 'OMSATTNING 786 930,85 809 973,89',
          pageNumber: 4,
        },
        {
          key: 'henkilostokulut',
          label: 'Personnel costs',
          value: -235498.71,
          sourceLine: 'PERSONALKOSTNADER -235 498,71 -234 519,26',
          pageNumber: 4,
        },
      ],
      veetiFinancials: {
        Liikevaihto: 700000,
        Henkilostokulut: 120000,
        Poistot: 140000,
        TilikaudenYliJaama: 25000,
      },
      currentFinancials: {
        Liikevaihto: 740000,
        Henkilostokulut: 200000,
        Poistot: 180000,
        TilikaudenYliJaama: 12000,
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'liikevaihto',
          pdfValue: 786930.85,
          veetiValue: 700000,
          currentValue: 740000,
          changedFromVeeti: true,
          changedFromCurrent: true,
          sourceLine: 'OMSATTNING 786 930,85 809 973,89',
        }),
        expect.objectContaining({
          key: 'henkilostokulut',
          pdfValue: 235498.71,
          veetiValue: 120000,
          currentValue: 200000,
          changedFromVeeti: true,
          changedFromCurrent: true,
        }),
        expect.objectContaining({
          key: 'poistot',
          pdfValue: 186904.08,
          veetiValue: 140000,
          currentValue: 180000,
        }),
        expect.objectContaining({
          key: 'tilikaudenYliJaama',
          pdfValue: 3691.35,
          veetiValue: 25000,
          currentValue: 12000,
        }),
      ]),
    );
  });

  it('keeps finance and result signs intact while flipping expense magnitudes positive', () => {
    expect(normalizeStatementOcrFieldValue('henkilostokulut', -12)).toBe(12);
    expect(normalizeStatementOcrFieldValue('liiketoiminnanMuutKulut', -34.5)).toBe(
      34.5,
    );
    expect(normalizeStatementOcrFieldValue('poistot', -6)).toBe(6);
    expect(normalizeStatementOcrFieldValue('liikevaihto', 9)).toBe(9);
    expect(normalizeStatementOcrFieldValue('rahoitustuototJaKulut', -7)).toBe(
      -7,
    );
    expect(normalizeStatementOcrFieldValue('tilikaudenYliJaama', -3)).toBe(-3);
  });
});
