/** Line charts for projection result: revenue, net result, volume, price (same data as table). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  revenue: number;
  netResult: number;
  cumulative: number;
  volume: number;
  price: number;
}> {
  return years.map((y) => ({
    vuosi: y.vuosi,
    revenue: num(y.tulotYhteensa),
    netResult: num(y.tulos),
    cumulative: num(y.kumulatiivinenTulos),
    volume: num(y.myytyVesimaara),
    price: num(y.vesihinta),
  }));
}

const fmtEur = (n: number) =>
  n.toLocaleString('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString('fi-FI', { maximumFractionDigits: 0 });

export const ProjectionCharts: React.FC<ProjectionChartsProps> = ({ years }) => {
  const { t } = useTranslation();
  const data = toChartData(years);

  if (data.length === 0) return null;

  return (
    <div className="projection-charts-panel">
      <h4 className="projection-charts-panel__title">{t('projection.viewTabDiagram')}</h4>
      <div className="projection-charts">
      <div className="projection-chart-card">
        <h4>{t('projection.columns.revenue')}</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtEur} tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number | undefined) => [v != null ? fmtEur(v) : '—', t('projection.columns.revenue')]} labelFormatter={(v) => `${v}`} />
            <Line type="monotone" dataKey="revenue" stroke="var(--chart-revenue, #2563eb)" strokeWidth={2} dot={{ r: 3 }} name={t('projection.columns.revenue')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="projection-chart-card">
        <h4>{t('projection.columns.netResult')}</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtEur} tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number | undefined) => [v != null ? fmtEur(v) : '—', t('projection.columns.netResult')]} labelFormatter={(v) => `${v}`} />
            <Line type="monotone" dataKey="netResult" stroke="var(--chart-result, #059669)" strokeWidth={2} dot={{ r: 3 }} name={t('projection.columns.netResult')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="projection-chart-card">
        <h4>{t('projection.columns.cumulative')}</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtEur} tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number | undefined) => [v != null ? fmtEur(v) : '—', t('projection.columns.cumulative')]} labelFormatter={(v) => `${v}`} />
            <Line type="monotone" dataKey="cumulative" stroke="var(--chart-cumulative, #7c3aed)" strokeWidth={2} dot={{ r: 3 }} name={t('projection.columns.cumulative')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="projection-chart-card">
        <h4>{t('projection.columns.waterPrice')}</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(2)} €/m³`} tick={{ fontSize: 11 }} width={72} />
            <Tooltip formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} €/m³` : '—', t('projection.columns.waterPrice')]} labelFormatter={(v) => `${v}`} />
            <Line type="monotone" dataKey="price" stroke="var(--chart-price, #dc2626)" strokeWidth={2} dot={{ r: 3 }} name={t('projection.columns.waterPrice')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="projection-chart-card">
        <h4>{t('projection.columns.volume')}</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vuosi" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtNum} tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number | undefined) => [v != null ? `${fmtNum(v)} m³` : '—', t('projection.columns.volume')]} labelFormatter={(v) => `${v}`} />
            <Line type="monotone" dataKey="volume" stroke="var(--chart-volume, #0891b2)" strokeWidth={2} dot={{ r: 3 }} name={t('projection.columns.volume')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>
    </div>
  );
};
