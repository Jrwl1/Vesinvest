import React from 'react';

type Props = {
  latestYear: number | null;
  revenue: number;
  costs: number;
  result: number;
  totalVolume: number;
};

export const DashboardKPIs: React.FC<Props> = ({ latestYear, revenue, costs, result, totalVolume }) => {
  const fmt = (value: number) => value.toLocaleString('fi-FI', { maximumFractionDigits: 0 });
  return (
    <section className="dashboard-kpis">
      <article className="kpi-card">
        <h4>Viimeisin vuosi</h4>
        <p>{latestYear ?? '-'}</p>
      </article>
      <article className="kpi-card">
        <h4>Liikevaihto</h4>
        <p>{fmt(revenue)} €</p>
      </article>
      <article className="kpi-card">
        <h4>Kulut + poistot</h4>
        <p>{fmt(costs)} €</p>
      </article>
      <article className="kpi-card">
        <h4>Tulos</h4>
        <p className={result >= 0 ? 'positive' : 'negative'}>{fmt(result)} €</p>
      </article>
      <article className="kpi-card">
        <h4>Myyty määrä</h4>
        <p>{fmt(totalVolume)} m³</p>
      </article>
    </section>
  );
};

