import React from 'react';
import type { VeetiOrganizationSearchHit } from '../../api';

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  loading: boolean;
  results: VeetiOrganizationSearchHit[];
  selectedId: number | null;
  onSelect: (org: VeetiOrganizationSearchHit) => void;
};

export const VeetiSearchStep: React.FC<Props> = ({
  query,
  onQueryChange,
  onSearch,
  loading,
  results,
  selectedId,
  onSelect,
}) => {
  return (
    <section className="panel">
      <h3>1. Hae organisaatio</h3>
      <div className="form-row veeti-search-row">
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Nimi tai Y-tunnus"
          className="input-field"
        />
        <button type="button" className="btn btn-primary" onClick={onSearch} disabled={loading || query.trim().length < 2}>
          {loading ? 'Haetaan...' : 'Hae'}
        </button>
      </div>

      <ul className="veeti-search-results">
        {results.map((org) => (
          <li key={org.Id}>
            <button
              type="button"
              className={`veeti-result-btn ${selectedId === org.Id ? 'active' : ''}`}
              onClick={() => onSelect(org)}
            >
              <strong>{org.Nimi ?? `Org ${org.Id}`}</strong>
              <span>{org.YTunnus ?? 'Y-tunnus puuttuu'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

