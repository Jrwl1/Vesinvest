import { describe, expect, it } from 'vitest';

import fi from './fi.json';
import sv from './sv.json';
import en from './en.json';

import projectionPageRaw from '../../pages/ProjectionPage.tsx?raw';
import budgetPageRaw from '../../pages/BudgetPage.tsx?raw';
import yearEditorRaw from '../../components/EnnusteYearEditorDrawer.tsx?raw';
import comboChartRaw from '../../components/EnnusteComboChart.tsx?raw';

const localeEntries = [
  { locale: 'fi', data: fi },
  { locale: 'sv', data: sv },
  { locale: 'en', data: en },
] as const;

const uiStringFiles = [
  { name: 'ProjectionPage.tsx', raw: projectionPageRaw },
  { name: 'BudgetPage.tsx', raw: budgetPageRaw },
  { name: 'EnnusteYearEditorDrawer.tsx', raw: yearEditorRaw },
  { name: 'EnnusteComboChart.tsx', raw: comboChartRaw },
] as const;

const mojibakePattern = /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u024F]|\uFFFD/;

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

describe('locale integrity', () => {
  it('contains no mojibake sequences in locale values', () => {
    for (const { locale, data } of localeEntries) {
      const text = JSON.stringify(data);
      expect(text, `mojibake found in locale ${locale}`).not.toMatch(mojibakePattern);
    }
  });

  it('contains no mojibake sequences in core projection UI files', () => {
    for (const file of uiStringFiles) {
      expect(file.raw, `mojibake found in ${file.name}`).not.toMatch(mojibakePattern);
    }
  });

  it('has projection.v2 parity for required keys in fi/sv/en', () => {
    const requiredV2Keys = [
      'pageTitle',
      'inputsTitle',
      'volumeTitle',
      'volumeHint',
      'historyYearsLabel',
      'manualYearsLabel',
      'futureYearsLabel',
      'assumptionsTitle',
      'investmentsTitle',
      'investmentsHint',
      'addInvestment',
      'removeInvestment',
      'advancedTitle',
      'computeBtn',
      'computingBtn',
      'firstComputeBtn',
      'kpiRequiredTariff',
      'kpiTariffikorotus',
      'kpiTariffNext',
      'kpiCumulative',
      'kpiInvestments',
      'kpiCashflow',
      'chartTariffLabel',
      'chartRevenueLabel',
      'chartCostsLabel',
      'chartInvestmentsLabel',
      'chartCashflowLabel',
      'assumptionKayttomenot',
      'assumptionEnergia',
      'assumptionHenkilosto',
      'assumptionVesimaara',
      'assumptionTariffi',
      'assumptionInvestointi',
      'personnelManualHint',
      'detailedTableTitle',
      'yearEditorTitle',
      'selectedYear',
      'waterPriceCardTitle',
      'waterPriceGrowth',
      'lockPrice',
      'lockPercent',
      'investmentCardTitle',
      'investmentYearAmount',
      'categoryCardTitle',
      'categoryPersonnel',
      'categoryEnergy',
      'categoryOpexOther',
      'categoryOtherIncome',
      'categoryInvestments',
      'lineOverrideTitle',
      'lineOverrideEmpty',
      'clearYearOverrides',
    ];

    for (const { locale, data } of localeEntries) {
      for (const key of requiredV2Keys) {
        const value = pick(data as Record<string, unknown>, `projection.v2.${key}`);
        expect(value, `${locale}: missing projection.v2.${key}`).toBeTypeOf('string');
      }
    }
  });

  it('uses water-price terminology in projection labels', () => {
    const forbidden = /\b(tariffi|tariff|taxa)\b/i;
    const paths = [
      'projection.summary.requiredTariff',
      'projection.kpi.requiredTariffGrowth',
      'projection.kpi.tariffYearPlusOne',
      'projection.charts.tariffTrend',
      'projection.charts.tariffHint',
      'projection.charts.tariffSeries',
      'projection.v2.kpiRequiredTariff',
      'projection.v2.kpiTariffikorotus',
      'projection.v2.kpiTariffNext',
      'projection.v2.chartTariffLabel',
      'projection.v2.assumptionTariffi',
    ];

    for (const { locale, data } of localeEntries) {
      for (const p of paths) {
        const value = pick(data as Record<string, unknown>, p);
        expect(value, `${locale}: missing ${p}`).toBeTypeOf('string');
        expect(String(value), `${locale}: forbidden term in ${p}`).not.toMatch(forbidden);
      }
    }
  });
});
