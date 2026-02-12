/** Finansieringsplan / Kassaflöde light: Ackumulerad kassa line chart + Intäkter vs Kostnader bar chart. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ProjectionYear } from '../api';

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(String(v));
}

export interface ProjectionChartsProps {
  years: ProjectionYear[];
}

/** Build chart data array from projection years. */
function toChartData(years: ProjectionYear[]): Array<{
  vuosi: number;
  ackumuleradKassa: number;
  tulot: number;
  kulut: number;
  investoinnit: number;
  kostnaderYhteensa: number;
}> {
  let runningAckum = 0;
  return years.map((y) => {
    const tulot = num(y.tulotYhteensa);
    const kulut = num(y.kulutYhteensa);
    const inv = num(y.investoinnitYhteensa);
    const kassafloede = num(y.tulos) - inv;
    runningAckum += kassafloede;
    const ackumVal = typeof y.ackumuleradKassa === 'number' ? y.ackumuleradKassa : Math.round(runningAckum * 100) / 100;
    return {
      vuosi: y.vuosi,
      ackumuleradKassa: ackumVal,
      tulot,
      kulut,
      investoinnit: inv,
      kostnaderYhteensa: kulut + inv,
    };
  });
}

const fmtEur = (n: number) =>
  n.toLocaleString('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const ProjectionCharts: React.FC<ProjectionChartsProps> = ({ years }) => {
  const { t } = useTranslation();
  const data = toChartData(years);

  if (data.length === 0) return null;

  return (
    <div className="projection-charts-panel">
      <h4 className="projection-charts-panel__title">{t('projection.viewTabDiagram')}</h4>
      <div className="projection-charts">
        <div className="projection-chart-card">
          <h4>{t('projection.summary.accumulatedCash')}</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmtEur} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(v: number | undefined) => [v != null ? fmtEur(v) : '—', t('projection.summary.accumulatedCash')]}
                labelFormatter={(v) => `${v}`}
              />
              <Line
                type="monotone"
                dataKey="ackumuleradKassa"
                stroke="var(--chart-cumulative, #7c3aed)"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={t('projection.summary.accumulatedCash')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="projection-chart-card">
          <h4>{t('projection.charts.revenueVsCosts')}</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmtEur} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number | undefined) => (v != null ? fmtEur(v) : '—')} labelFormatter={(v) => `${v}`} />
              <Legend />
              <Bar dataKey="tulot" fill="var(--chart-revenue, #2563eb)" name={t('projection.columns.revenue')} />
              <Bar dataKey="kulut" stackId="kostnader" fill="var(--chart-costs, #dc2626)" name={t('projection.columns.expenses')} />
              <Bar dataKey="investoinnit" stackId="kostnader" fill="var(--chart-investments, #f59e0b)" name={t('projection.columns.investments')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
