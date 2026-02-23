import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Point = {
  year: number;
  result: number;
};

type Props = {
  data: Point[];
};

export const DashboardTrendChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return <section className="panel">Ei trendidataa vielä.</section>;
  }

  return (
    <section className="panel dashboard-trend-panel">
      <h3>Tuloskehitys</h3>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value: number | undefined) => `${(value ?? 0).toLocaleString('fi-FI')} €`} />
            <Line type="monotone" dataKey="result" stroke="#0f766e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

