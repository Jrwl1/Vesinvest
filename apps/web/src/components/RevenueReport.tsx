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

function fmtTariff(n: number): string {
  return `${n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/m³`;
}

function fmtVolume(n: number): string {
  return `${Math.round(n).toLocaleString('fi-FI')} m³`;
}

interface RevenueReportProps {
  years: ProjectionYear[];
  scenarioName: string;
}

export const RevenueReport: React.FC<RevenueReportProps> = ({ years, scenarioName }) => {
  const { t } = useTranslation();

  if (years.length === 0) return null;

  const rows = years.map((year) => {
    const drivers = year.erittelyt?.ajurit ?? [];
    const vesi = drivers.find((driver) => driver.palvelutyyppi === 'vesi');
    const jatevesi = drivers.find((driver) => driver.palvelutyyppi === 'jatevesi');
    const vesiRevenue = num(vesi?.laskettuTulo);
    const jatevesiRevenue = num(jatevesi?.laskettuTulo);
    const driverRevenue = vesiRevenue + jatevesiRevenue;
    const totalRevenue = num(year.tulotYhteensa);
    const otherRevenue = totalRevenue - driverRevenue;
    return {
      year: year.vuosi,
      vesiPrice: num(vesi?.yksikkohinta),
      vesiVolume: num(vesi?.myytyMaara),
      vesiRevenue,
      jatevesiPrice: num(jatevesi?.yksikkohinta),
      jatevesiVolume: num(jatevesi?.myytyMaara),
      jatevesiRevenue,
      otherRevenue,
      totalRevenue,
    };
  });

  const totals = rows.reduce((acc, row) => ({
    vesiRevenue: acc.vesiRevenue + row.vesiRevenue,
    jatevesiRevenue: acc.jatevesiRevenue + row.jatevesiRevenue,
    otherRevenue: acc.otherRevenue + row.otherRevenue,
    totalRevenue: acc.totalRevenue + row.totalRevenue,
  }), {
    vesiRevenue: 0,
    jatevesiRevenue: 0,
    otherRevenue: 0,
    totalRevenue: 0,
  });

  return (
    <div className="revenue-report">
      <div className="revenue-report__header">
        <h3>{t('revenue.title')} - {scenarioName}</h3>
        <p className="revenue-report__purpose">{t('projection.revenueReportPurpose')}</p>
      </div>

      <div className="revenue-report__table-wrap">
        <table className="revenue-report-table">
          <thead>
            <tr>
              <th>{t('projection.columns.year')}</th>
              <th className="num-col">{t('revenue.water.unitPrice')}</th>
              <th className="num-col">{t('revenue.water.soldVolume')}</th>
              <th className="num-col">{t('revenue.water.revenue')}</th>
              <th className="num-col">{t('revenue.wastewater.unitPrice', 'Jätevesihinta')}</th>
              <th className="num-col">{t('revenue.wastewater.soldVolume', 'Jäteveden määrä')}</th>
              <th className="num-col">{t('revenue.wastewater.revenue')}</th>
              <th className="num-col">{t('projection.columns.revenue')} ({t('common.other', 'Muut')})</th>
              <th className="num-col">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td className="num-col">{row.vesiPrice > 0 ? fmtTariff(row.vesiPrice) : '-'}</td>
                <td className="num-col">{row.vesiVolume > 0 ? fmtVolume(row.vesiVolume) : '-'}</td>
                <td className="num-col">{fmtEur(row.vesiRevenue)}</td>
                <td className="num-col">{row.jatevesiPrice > 0 ? fmtTariff(row.jatevesiPrice) : '-'}</td>
                <td className="num-col">{row.jatevesiVolume > 0 ? fmtVolume(row.jatevesiVolume) : '-'}</td>
                <td className="num-col">{fmtEur(row.jatevesiRevenue)}</td>
                <td className="num-col">{fmtEur(row.otherRevenue)}</td>
                <td className="num-col revenue-report-table__total">{fmtEur(row.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('common.total')}</td>
              <td colSpan={2} />
              <td className="num-col">{fmtEur(totals.vesiRevenue)}</td>
              <td colSpan={2} />
              <td className="num-col">{fmtEur(totals.jatevesiRevenue)}</td>
              <td className="num-col">{fmtEur(totals.otherRevenue)}</td>
              <td className="num-col revenue-report-table__total">{fmtEur(totals.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
