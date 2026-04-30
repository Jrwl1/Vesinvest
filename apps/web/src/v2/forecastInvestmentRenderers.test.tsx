import type { TFunction } from 'i18next';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  renderForecastInvestmentEditorRows,
  renderForecastInvestmentProgramRows,
} from './forecastInvestmentRenderers';

const t = ((_: string, fallback: string) => fallback) as TFunction;

const staleLinkedRow = {
  rowId: 'row-1',
  year: 2026,
  amount: 100000,
  target: 'Ledningsn\u00e4t saneering 2026-2030',
  category: 'Sanering / vattennätverk',
  depreciationClassKey: 'sanering_water_network',
  investmentType: 'replacement',
  confidence: 'high',
  waterAmount: 100000,
  wastewaterAmount: null,
  note: 'Plausible 20-year investment programme for audit flow.',
  vesinvestPlanId: 'plan-1',
  vesinvestProjectId: 'project-1',
  allocationId: 'allocation-1',
  projectCode: 'P-001',
  groupKey: 'sanering_water_network',
  accountKey: 'sanering_water_network',
  reportGroupKey: 'network_rehabilitation',
};

describe('forecast investment renderers', () => {
  it('does not render validation placeholders in program or annual rows', () => {
    const noop = vi.fn();

    render(
      <>
        {renderForecastInvestmentProgramRows({
          rows: [staleLinkedRow as any],
          t,
          handleInvestmentMetadataChange: noop,
          handleInvestmentProgramAmountChange: noop,
          handleInvestmentChange: noop,
          handleInvestmentBlur: noop,
          loadingDepreciation: false,
          depreciationRulesUnavailable: false,
          effectiveInvestmentDepreciationClassByYear: {},
          depreciationClassOptions: [],
          formatDepreciationRuleSummary: () => 'Linear',
        })}
        {renderForecastInvestmentEditorRows({
          rows: [staleLinkedRow as any],
          t,
          handleInvestmentMetadataChange: noop,
          handleInvestmentChange: noop,
          handleInvestmentBlur: noop,
        })}
      </>,
    );

    expect(screen.getByText('Network rehabilitation 2026-2030')).toBeTruthy();
    expect(
      screen.getAllByDisplayValue(
        'Investment programme reviewed for the active plan.',
      ).length,
    ).toBeGreaterThan(1);
    expect(screen.queryByText('Ledningsnät saneering 2026-2030')).toBeNull();
    expect(
      screen.queryByDisplayValue(
        'Plausible 20-year investment programme for audit flow.',
      ),
    ).toBeNull();
  });
});
