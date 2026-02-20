/**
 * EnnusteComboChart - V2 redesign combo chart.
 *
 * Composed chart combining:
 *  - Stacked bars: Revenue vs operating costs vs investments
 *  - Line overlay: Water price EUR/m3 (blue, right Y-axis)
 *  - ReferenceLine at 0 to show breakeven
 *  - Click handler to select a year
 */
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { ProjectionYear } from '../api';
import { formatEurInt, formatTariffEurPerM3 } from '../utils/format';

function n(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

interface ChartRow {
  vuosi: number;
  tulot: number;
  kayttomenot: number;
  investoinnit: number;
  tariffi: number;
  kassavirta: number;
  isDeficit: boolean;
}

function toRows(years: ProjectionYear[]): ChartRow[] {
  return years.map((y) => {
    const tulot = n(y.tulotYhteensa);
    const kayttomenot = n(y.kulutYhteensa);
    const investoinnit = n(y.investoinnitYhteensa);
    const tulos = n(y.tulos);
    const kassavirta = typeof y.kassafloede === 'number' ? y.kassafloede : tulos - investoinnit;
    return {
      vuosi: y.vuosi,
      tulot,
      kayttomenot,
      investoinnit,
      tariffi: n(y.vesihinta),
      kassavirta,
      isDeficit: tulos < 0,
    };
  });
}

type ChartTooltipRow = {
  dataKey?: string | number;
  value?: number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipRow[];
  label?: string | number;
  labels: {
    waterPrice: string;
    revenue: string;
    costs: string;
    investments: string;
    cashflow: string;
  };
};

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, labels }) => {
  if (!active || !payload?.length) return null;
  const get = (name: string) => payload.find((p) => p.dataKey === name)?.value as number | undefined;

  return (
    <div className="ev2-tooltip">
      <div className="ev2-tooltip__year">{label}</div>
      <div className="ev2-tooltip__row ev2-tooltip__row--tariff">
        <span className="ev2-tooltip__dot ev2-tooltip__dot--tariff" />
        <span>{labels.waterPrice}</span>
        <span>{formatTariffEurPerM3(get('tariffi'))}</span>
      </div>
      <div className="ev2-tooltip__row">
        <span className="ev2-tooltip__dot ev2-tooltip__dot--tulot" />
        <span>{labels.revenue}</span>
        <span>{formatEurInt(get('tulot'))}</span>
      </div>
      <div className="ev2-tooltip__row">
        <span className="ev2-tooltip__dot ev2-tooltip__dot--kulut" />
        <span>{labels.costs}</span>
        <span>{formatEurInt(get('kayttomenot'))}</span>
      </div>
      <div className="ev2-tooltip__row">
        <span className="ev2-tooltip__dot ev2-tooltip__dot--inv" />
        <span>{labels.investments}</span>
        <span>{formatEurInt(get('investoinnit'))}</span>
      </div>
      <div className="ev2-tooltip__divider" />
      <div className="ev2-tooltip__row ev2-tooltip__row--kassavirta">
        <span>{labels.cashflow}</span>
        <span className={(get('kassavirta') ?? 0) >= 0 ? 'ev2-positive' : 'ev2-negative'}>
          {formatEurInt(get('kassavirta'))}
        </span>
      </div>
    </div>
  );
};

interface EnnusteComboChartProps {
  years: ProjectionYear[];
  selectedYear: number | null;
  onYearClick: (year: number) => void;
}

export const EnnusteComboChart: React.FC<EnnusteComboChartProps> = ({
  years,
  selectedYear,
  onYearClick,
}) => {
  const { t } = useTranslation();
  const data = toRows(years);
  const labels = {
    waterPrice: t('projection.columns.waterPrice'),
    revenue: t('projection.v2.chartRevenueLabel'),
    costs: t('projection.v2.chartCostsLabel'),
    investments: t('projection.v2.chartInvestmentsLabel'),
    cashflow: t('projection.v2.chartCashflowLabel'),
  };

  const handleClick = useCallback(
    (payload: { activePayload?: Array<{ payload: ChartRow }> }) => {
      const row = payload?.activePayload?.[0]?.payload;
      if (row) onYearClick(row.vuosi);
    },
    [onYearClick],
  );

  if (data.length === 0) return null;

  const eurFormatter = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${Math.round(v)}`;
  };

  const tariffFormatter = (v: number) => `${v.toFixed(2)}`;

  return (
    <ResponsiveContainer width="100%" height={460}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 64, left: 8, bottom: 8 }}
        onClick={handleClick as any}
        style={{ cursor: 'pointer' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />

        <ReferenceLine yAxisId="eur" y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        <XAxis
          dataKey="vuosi"
          tick={{ fontSize: 11, fill: '#7b8aaa' }}
          axisLine={{ stroke: '#2a3347' }}
          tickLine={false}
        />

        <YAxis
          yAxisId="eur"
          tickFormatter={eurFormatter}
          tick={{ fontSize: 11, fill: '#7b8aaa' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />

        <YAxis
          yAxisId="tariff"
          orientation="right"
          tickFormatter={tariffFormatter}
          tick={{ fontSize: 11, fill: '#60a5fa' }}
          axisLine={false}
          tickLine={false}
          width={44}
          label={{ value: '€/m³', angle: 90, position: 'insideRight', fill: '#60a5fa', fontSize: 10, dx: 12 }}
        />

        <Tooltip content={<ChartTooltip labels={labels} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        <Legend
          wrapperStyle={{ fontSize: 12, color: '#7b8aaa', paddingTop: 8 }}
          formatter={(value) => {
            const legendLabels: Record<string, string> = {
              tulot: t('projection.v2.chartRevenueLabel'),
              kayttomenot: t('projection.v2.chartCostsLabel'),
              investoinnit: t('projection.v2.chartInvestmentsLabel'),
              tariffi: t('projection.v2.chartTariffLabel'),
            };
            return legendLabels[value] ?? value;
          }}
        />

        {selectedYear != null && (
          <ReferenceLine
            yAxisId="eur"
            x={selectedYear}
            stroke="rgba(96,165,250,0.3)"
            strokeWidth={24}
            strokeLinecap="round"
          />
        )}

        <Bar
          yAxisId="eur"
          dataKey="tulot"
          fill="#22c55e"
          fillOpacity={0.85}
          radius={[2, 2, 0, 0]}
          maxBarSize={32}
          name="tulot"
        />

        <Bar
          yAxisId="eur"
          dataKey="kayttomenot"
          fill="#ef4444"
          fillOpacity={0.75}
          radius={[2, 2, 0, 0]}
          maxBarSize={32}
          name="kayttomenot"
        />

        <Bar
          yAxisId="eur"
          dataKey="investoinnit"
          fill="#f59e0b"
          fillOpacity={0.75}
          radius={[2, 2, 0, 0]}
          maxBarSize={32}
          name="investoinnit"
        />

        <Line
          yAxisId="tariff"
          type="monotone"
          dataKey="tariffi"
          stroke="#60a5fa"
          strokeWidth={2.5}
          dot={(props: any) => {
            const isSelected = props.payload?.vuosi === selectedYear;
            return (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={isSelected ? 5 : 3}
                fill={isSelected ? '#93c5fd' : '#60a5fa'}
                stroke={isSelected ? '#fff' : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
              />
            );
          }}
          activeDot={{ r: 5, fill: '#93c5fd', stroke: '#fff', strokeWidth: 1.5 }}
          name="tariffi"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
