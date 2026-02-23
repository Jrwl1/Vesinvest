import React from 'react';
import type { BenchmarkMetric } from '../../api';

type Props = {
  metric: BenchmarkMetric;
};

export const BenchmarkMetricCard: React.FC<Props> = ({ metric }) => {
  const format = (value: number | null) => (value == null ? '-' : value.toLocaleString('fi-FI', { maximumFractionDigits: 2 }));
  return (
    <article className="metric-card">
      <h4>{metric.metricKey}</h4>
      <p>Oma: <strong>{format(metric.yourValue)}</strong></p>
      <p>Mediaani: {format(metric.medianValue)}</p>
      <p>P25/P75: {format(metric.p25Value)} / {format(metric.p75Value)}</p>
    </article>
  );
};

