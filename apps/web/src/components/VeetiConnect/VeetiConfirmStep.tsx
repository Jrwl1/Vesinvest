import React from 'react';
import type { VeetiOrganizationSearchHit } from '../../api';

type Props = {
  selectedOrg: VeetiOrganizationSearchHit | null;
  selectedYears: number[];
  connecting: boolean;
  generating: boolean;
  onConnectAndSync: () => void;
  onGenerate: () => void;
};

export const VeetiConfirmStep: React.FC<Props> = ({
  selectedOrg,
  selectedYears,
  connecting,
  generating,
  onConnectAndSync,
  onGenerate,
}) => {
  return (
    <section className="panel">
      <h3>3. Vahvista</h3>
      <p>
        <strong>Organisaatio:</strong> {selectedOrg ? `${selectedOrg.Nimi ?? selectedOrg.Id} (${selectedOrg.YTunnus ?? 'ei Y-tunnusta'})` : 'ei valittu'}
      </p>
      <p><strong>Valitut vuodet:</strong> {selectedYears.length > 0 ? selectedYears.sort((a, b) => a - b).join(', ') : 'ei valittu'}</p>

      <div className="button-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onConnectAndSync}
          disabled={!selectedOrg || connecting}
        >
          {connecting ? 'Yhdistetään...' : 'Yhdistä ja hae data'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={selectedYears.length === 0 || generating}
        >
          {generating ? 'Luodaan budjetteja...' : 'Luo budjetit valituille vuosille'}
        </button>
      </div>
    </section>
  );
};

