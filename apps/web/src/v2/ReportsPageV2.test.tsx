import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsPageV2 } from './ReportsPageV2';

const listReportsV2 = vi.fn();
const getReportV2 = vi.fn();
const downloadReportPdfV2 = vi.fn();

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, options?: Record<string, unknown>) =>
      defaultValue?.replace('{{fileName}}', String(options?.fileName ?? '')) ??
      key,
  }),
}));

vi.mock('../api', () => ({
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
  getReportV2: (...args: unknown[]) => getReportV2(...args),
  downloadReportPdfV2: (...args: unknown[]) => downloadReportPdfV2(...args),
}));

describe('ReportsPageV2', () => {
  beforeEach(() => {
    listReportsV2.mockReset();
    getReportV2.mockReset();
    downloadReportPdfV2.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows statement-import provenance and hides confidential appendix sections in public preview', async () => {
    listReportsV2.mockResolvedValue([
      {
        id: 'report-1',
        title: 'Scenario report',
        createdAt: '2026-03-08T10:00:00.000Z',
        ennuste: { id: 'scenario-1', nimi: 'Statement-backed scenario' },
        baselineYear: 2024,
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 14,
        totalInvestments: 150000,
        variant: 'confidential_appendix',
        pdfUrl: '/v2/reports/report-1/pdf',
      },
    ]);
    getReportV2.mockResolvedValue({
      id: 'report-1',
      title: 'Scenario report',
      createdAt: '2026-03-08T10:00:00.000Z',
      baselineYear: 2024,
      requiredPriceToday: 3.2,
      requiredAnnualIncreasePct: 14,
      totalInvestments: 150000,
      ennuste: { id: 'scenario-1', nimi: 'Statement-backed scenario' },
      variant: 'confidential_appendix',
      pdfUrl: '/v2/reports/report-1/pdf',
      snapshot: {
        generatedAt: '2026-03-08T10:00:00.000Z',
        reportVariant: 'confidential_appendix',
        reportSections: {
          baselineSources: true,
          assumptions: true,
          yearlyInvestments: true,
          riskSummary: true,
        },
        baselineSourceSummary: {
          year: 2024,
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
          financials: {
            dataType: 'tilinpaatos',
            source: 'manual',
            provenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
            },
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'user-1',
            reason: 'Statement import',
          },
          prices: {
            dataType: 'taksa',
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
          volumes: {
            dataType: 'volume_vesi+volume_jatevesi',
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
        },
        scenario: {
          id: 'scenario-1',
          name: 'Statement-backed scenario',
          onOletus: false,
          talousarvioId: 'budget-1',
          baselineYear: 2024,
          horizonYears: 20,
          assumptions: {
            inflaatio: 0.025,
            hintakorotus: 0.03,
          },
          yearlyInvestments: [
            {
              year: 2024,
              amount: 150000,
              category: 'network',
              investmentType: 'replacement',
              confidence: 'high',
              note: 'Main line renewal',
            },
          ],
          nearTermExpenseAssumptions: [],
          thereafterExpenseAssumptions: {
            personnelPct: 2,
            energyPct: 3,
            opexOtherPct: 2,
          },
          requiredPriceTodayCombined: 3.1,
          baselinePriceTodayCombined: 2.5,
          requiredAnnualIncreasePct: 12,
          requiredPriceTodayCombinedAnnualResult: 3.2,
          requiredAnnualIncreasePctAnnualResult: 14,
          requiredPriceTodayCombinedCumulativeCash: 3.4,
          requiredAnnualIncreasePctCumulativeCash: 18,
          feeSufficiency: {
            baselineCombinedPrice: 2.5,
            annualResult: {
              requiredPriceToday: 3.2,
              requiredAnnualIncreasePct: 14,
              underfundingStartYear: 2027,
              peakDeficit: 25000,
            },
            cumulativeCash: {
              requiredPriceToday: 3.4,
              requiredAnnualIncreasePct: 18,
              underfundingStartYear: 2026,
              peakGap: 90000,
            },
          },
          years: [],
          priceSeries: [],
          investmentSeries: [],
          cashflowSeries: [],
          updatedAt: '2026-03-08T10:00:00.000Z',
          createdAt: '2026-03-08T10:00:00.000Z',
        },
      },
    });

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId="report-1"
        onGoToForecast={() => undefined}
      />,
    );

    expect(
      await screen.findByText('Statement import (bokslut-2024.pdf)'),
    ).toBeTruthy();
    expect(screen.getByText('Saved report is available for export.')).toBeTruthy();
    expect(screen.getByText('Assumptions from snapshot')).toBeTruthy();
    expect(screen.getByText('Yearly investments from snapshot')).toBeTruthy();
    expect(screen.getByText('Years covered')).toBeTruthy();
    expect(screen.getByText('Peak year')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Public summary' }));

    await waitFor(() => {
      expect(screen.queryByText('Assumptions from snapshot')).toBeNull();
      expect(screen.queryByText('Yearly investments from snapshot')).toBeNull();
    });

    expect(screen.getByText('Baseline data sources')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', { name: 'Download PDF' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
