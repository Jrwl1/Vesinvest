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
import { formatEurInt, formatTariffEurPerM3 } from '../utils/format';

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(String(v));
}

type ProjectionChartMode = 'full' | 'hero';

export interface ProjectionChartsProps {
  years: ProjectionYear[];
  mode?: ProjectionChartMode;
}

function toChartData(years: ProjectionYear[]): Array<{
  vuosi: number;
  ackumuleradKassa: number;
  tulot: number;
  kulut: number;
  investoinnit: number;
  kostnaderYhteensa: number;
  tulos: number;
  vesihinta: number;
}> {
  let runningAckum = 0;
  return years.map((y) => {
    const tulot = num(y.tulotYhteensa);
    const kulut = num(y.kulutYhteensa);
    const investoinnit = num(y.investoinnitYhteensa);
    const tulos = num(y.tulos);
    const kassafloede = typeof y.kassafloede === 'number' ? y.kassafloede : tulos - investoinnit;
    runningAckum += kassafloede;

    const ackumVal = typeof y.ackumuleradKassa === 'number'
      ? y.ackumuleradKassa
      : Math.round(runningAckum * 100) / 100;

    return {
      vuosi: y.vuosi,
      ackumuleradKassa: ackumVal,
      tulot,
      kulut,
      investoinnit,
      kostnaderYhteensa: kulut + investoinnit,
      tulos,
      vesihinta: num(y.vesihinta),
    };
  });
}

export const ProjectionCharts: React.FC<ProjectionChartsProps> = ({ years, mode = 'full' }) => {
  const { t } = useTranslation();
  const data = toChartData(years);

  if (data.length === 0) return null;

  const showFullCharts = mode === 'full';

  return (
    <div className={`projection-charts-panel projection-charts-panel--${mode}`}>
      {showFullCharts && <h4 className="projection-charts-panel__title">{t('projection.viewTabDiagram')}</h4>}
      <div className="projection-charts">
        <div className="projection-chart-card projection-chart-card--tariff">
          <h4>{t('projection.charts.tariffTrend')}</h4>
          <ResponsiveContainer width="100%" height={mode === 'hero' ? 320 : 260}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(value: number) => Number(value).toFixed(2)}
              />
              <Tooltip
                formatter={(value: number | undefined) => value != null
                  ? [formatTariffEurPerM3(value), t('projection.charts.tariffSeries')]
                  : ['—', t('projection.charts.tariffSeries')]}
                labelFormatter={(value) => `${value}`}
              />
              <Line
                type="monotone"
                dataKey="vesihinta"
                stroke="var(--chart-tariff, #0f766e)"
                strokeWidth={3}
                dot={{ r: 3 }}
                name={t('projection.charts.tariffSeries')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {showFullCharts && (
          <>
            <div className="projection-chart-card">
              <h4>{t('projection.summary.accumulatedCash')}</h4>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatEurInt} tick={{ fontSize: 11 }} width={76} />
                  <Tooltip
                    formatter={(v: number | undefined) => [v != null ? formatEurInt(v) : '—', t('projection.summary.accumulatedCash')]}
                    labelFormatter={(v) => `${v}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="ackumuleradKassa"
                    stroke="var(--chart-cumulative, #0f172a)"
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
                  <YAxis tickFormatter={formatEurInt} tick={{ fontSize: 11 }} width={76} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? formatEurInt(v) : '—')} labelFormatter={(v) => `${v}`} />
                  <Legend />
                  <Bar dataKey="tulot" fill="var(--chart-revenue, #2563eb)" name={t('projection.columns.revenue')} />
                  <Bar dataKey="kulut" stackId="kostnader" fill="var(--chart-costs, #dc2626)" name={t('projection.columns.expenses')} />
                  <Bar dataKey="investoinnit" stackId="kostnader" fill="var(--chart-investments, #f59e0b)" name={t('projection.columns.investments')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
