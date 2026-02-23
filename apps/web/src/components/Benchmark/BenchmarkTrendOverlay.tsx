import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BenchmarkTrendResult } from '../../api';

type Props = {
  trend: BenchmarkTrendResult | null;
};

export const BenchmarkTrendOverlay: React.FC<Props> = ({ trend }) => {
  if (!trend || trend.trend.length === 0) return <section className="panel">Ei trendidataa.</section>;

  return (
    <section className="panel">
      <h3>Trendit: {trend.metricKey}</h3>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend.trend}>
            <XAxis dataKey="vuosi" />
            <YAxis />
            <Tooltip />
            <Line dataKey="yourValue" type="monotone" stroke="#0f766e" strokeWidth={2} />
            <Line dataKey="medianValue" type="monotone" stroke="#1d4ed8" strokeDasharray="4 3" />
            <Line dataKey="p25Value" type="monotone" stroke="#9ca3af" strokeDasharray="2 2" />
            <Line dataKey="p75Value" type="monotone" stroke="#9ca3af" strokeDasharray="2 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

