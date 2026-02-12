import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { ProjectionCharts } from './ProjectionCharts';

function renderCharts(years: Parameters<typeof ProjectionCharts>[0]['years']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ProjectionCharts years={years} />
    </I18nextProvider>,
  );
}

describe('ProjectionCharts', () => {
  it('renders nothing when years is empty', () => {
    const { container } = renderCharts([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders chart cards when years have data', () => {
    const years = [
      {
        id: '1',
        ennusteId: 'e1',
        vuosi: 2024,
        tulotYhteensa: '100000',
        kulutYhteensa: '80000',
        investoinnitYhteensa: '5000',
        tulos: '15000',
        kumulatiivinenTulos: '15000',
        vesihinta: '1.5',
        myytyVesimaara: '50000',
        erittelyt: null,
      },
      {
        id: '2',
        ennusteId: 'e1',
        vuosi: 2025,
        tulotYhteensa: '105000',
        kulutYhteensa: '82000',
        investoinnitYhteensa: '6000',
        tulos: '17000',
        kumulatiivinenTulos: '32000',
        vesihinta: '1.55',
        myytyVesimaara: '51000',
        erittelyt: null,
      },
    ];
    const { container } = renderCharts(years);
    expect(container.querySelector('.projection-charts')).toBeTruthy();
    expect(container.querySelectorAll('.projection-chart-card').length).toBe(5);
  });
});
