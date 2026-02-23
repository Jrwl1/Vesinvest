import React from 'react';

type Props = {
  onGoToConnect: () => void;
  onGoToProjection: () => void;
  onGoToBenchmarks: () => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export const DashboardQuickActions: React.FC<Props> = ({
  onGoToConnect,
  onGoToProjection,
  onGoToBenchmarks,
  onRefresh,
  refreshing,
}) => {
  return (
    <section className="panel">
      <h3>Pikatoiminnot</h3>
      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={onGoToConnect}>Yhdistä VEETI</button>
        <button type="button" className="btn btn-secondary" onClick={onGoToProjection}>Luo ennuste</button>
        <button type="button" className="btn btn-secondary" onClick={onGoToBenchmarks}>Avaa vertailu</button>
        <button type="button" className="btn btn-primary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Päivitetään...' : 'Päivitä VEETI-tiedot'}
        </button>
      </div>
    </section>
  );
};

