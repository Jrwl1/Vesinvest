import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectionYear } from '../api';

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function fmtEur(n: number): string {
  return n.toLocaleString('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

interface RevenueReportProps {
  years: ProjectionYear[];
  scenarioName: string;
}

/**
 * Printable revenue breakdown report.
 * Shows detailed revenue composition per year from projection data.
 */
export const RevenueReport: React.FC<RevenueReportProps> = ({ years, scenarioName }) => {
  const { t } = useTranslation();

  if (years.length === 0) return null;

  return (
    <div className="revenue-report card">
      <h3>{t('revenue.title')} — {scenarioName}</h3>

      {/* Revenue drivers per year */}
      <div className="report-section">
        <h4>{t('revenue.water.title')} & {t('revenue.wastewater.title')}</h4>
        <table className="report-table">
          <thead>
            <tr>
              <th>{t('projection.columns.year')}</th>
              <th className="num-col">{t('revenue.water.unitPrice')}</th>
              <th className="num-col">{t('revenue.water.soldVolume')}</th>
              <th className="num-col">{t('revenue.water.revenue')}</th>
              <th className="num-col">{t('revenue.wastewater.revenue')}</th>
              <th className="num-col">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const drivers = y.erittelyt?.ajurit ?? [];
              const waterDriver = drivers.find((d) => d.palvelutyyppi === 'vesi');
              const wastewaterDriver = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
              const waterRev = waterDriver?.laskettuTulo ?? 0;
              const wastewaterRev = wastewaterDriver?.laskettuTulo ?? 0;

              return (
                <tr key={y.vuosi}>
                  <td>{y.vuosi}</td>
                  <td className="num-col">
                    {waterDriver ? `${waterDriver.yksikkohinta.toFixed(2)} €/m³` : '—'}
                  </td>
                  <td className="num-col">
                    {waterDriver ? `${Math.round(waterDriver.myytyMaara).toLocaleString('fi-FI')} m³` : '—'}
                  </td>
                  <td className="num-col">{fmtEur(waterRev)}</td>
                  <td className="num-col">{fmtEur(wastewaterRev)}</td>
                  <td className="num-col"><strong>{fmtEur(waterRev + wastewaterRev)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary revenue composition for base year */}
      {years.length > 0 && (
        <div className="report-section">
          <h4>{t('budget.sections.revenue')} — {years[0].vuosi} ({t('budget.title')})</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('budget.name')}</th>
                <th className="num-col">{t('budget.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Driver revenues */}
              {(years[0].erittelyt?.ajurit ?? []).map((d, i) => (
                <tr key={i}>
                  <td>
                    {d.palvelutyyppi === 'vesi' ? t('revenue.water.title')
                      : d.palvelutyyppi === 'jatevesi' ? t('revenue.wastewater.title')
                      : d.palvelutyyppi}
                    {' '}({t('common.computed')})
                  </td>
                  <td className="num-col">{fmtEur(d.laskettuTulo)}</td>
                </tr>
              ))}
              {/* Manual revenue lines */}
              {(years[0].erittelyt?.tulot ?? []).map((l, i) => (
                <tr key={`manual-${i}`}>
                  <td>{l.nimi}</td>
                  <td className="num-col">{fmtEur(l.summa)}</td>
                </tr>
              ))}
              {/* Total */}
              <tr className="total-row">
                <td>{t('common.total')}</td>
                <td className="num-col">{fmtEur(num(years[0].tulotYhteensa))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
