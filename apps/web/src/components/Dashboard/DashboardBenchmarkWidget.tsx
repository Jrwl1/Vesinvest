import React from 'react';
import type { BenchmarkYearResult } from '../../api';

type Props = {
  benchmark: BenchmarkYearResult | null;
};

export const DashboardBenchmarkWidget: React.FC<Props> = ({ benchmark }) => {
  if (!benchmark) {
    return <section className="panel">Vertailudataa ei saatavilla.</section>;
  }

  const liikevaihto = benchmark.metrics.find((metric) => metric.metricKey === 'liikevaihto');
  return (
    <section className="panel">
      <h3>Vertailu ({benchmark.vuosi})</h3>
      <p>Kokoluokka: <strong>{benchmark.kokoluokka}</strong></p>
      <p>Organisaatioita luokassa: <strong>{benchmark.orgCount}</strong></p>
      {benchmark.isStale && (
        <p className="muted">Varoitus: vertailudata on yli {benchmark.staleAfterDays} päivää vanhaa.</p>
      )}
      {liikevaihto && (
        <p>
          Liikevaihto: oma <strong>{Math.round(liikevaihto.yourValue ?? 0).toLocaleString('fi-FI')} €</strong>,
          mediaani <strong>{Math.round(liikevaihto.medianValue ?? 0).toLocaleString('fi-FI')} €</strong>
        </p>
      )}
    </section>
  );
};

