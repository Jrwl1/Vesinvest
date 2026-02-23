import React from 'react';
import type { VeetiYearInfo } from '../../api';

type Props = {
  years: VeetiYearInfo[];
  selectedYears: number[];
  onToggleYear: (year: number) => void;
};

export const VeetiPreviewStep: React.FC<Props> = ({ years, selectedYears, onToggleYear }) => {
  return (
    <section className="panel">
      <h3>2. Esikatselu</h3>
      <p className="muted">Valitse vuodet joille budjetit luodaan VEETI-datasta.</p>
      <div className="veeti-year-grid">
        {years.map((row) => {
          const selected = selectedYears.includes(row.vuosi);
          const complete = row.completeness.tilinpaatos && (row.completeness.volume_vesi || row.completeness.volume_jatevesi);
          return (
            <button
              key={row.vuosi}
              type="button"
              className={`veeti-year-card ${selected ? 'selected' : ''}`}
              onClick={() => onToggleYear(row.vuosi)}
            >
              <strong>{row.vuosi}</strong>
              <span className={complete ? 'ok' : 'warn'}>{complete ? 'Riittävä data' : 'Osittainen data'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

