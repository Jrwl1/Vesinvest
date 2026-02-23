import React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BenchmarkMetric } from '../../api';

type Props = {
  metric: BenchmarkMetric | null;
};

export const BenchmarkComparisonChart: React.FC<Props> = ({ metric }) => {
  if (!metric) return <section className="panel">Ei vertailumetriikkaa.</section>;

  const data = [
    { key: 'oma', value: metric.yourValue ?? 0 },
    { key: 'p25', value: metric.p25Value ?? 0 },
    { key: 'mediaani', value: metric.medianValue ?? 0 },
    { key: 'p75', value: metric.p75Value ?? 0 },
  ];

  return (
    <section className="panel">
      <h3>{metric.metricKey}: oma vs ryhmä</h3>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <XAxis dataKey="key" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#0d9488" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

