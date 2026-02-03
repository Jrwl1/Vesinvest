import React from 'react';
import type { Site, AssetStatus } from '../types';

interface FiltersBarProps {
  sites: Site[];
  selectedSiteId: string;
  onSiteChange: (siteId: string) => void;
  selectedStatus: AssetStatus | 'all';
  onStatusChange: (status: AssetStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewAsset: () => void;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  sites,
  selectedSiteId,
  onSiteChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onNewAsset,
}) => {
  return (
    <div className="filters-bar">
      <div className="filters-left">
        <div className="filter-group">
          <label htmlFor="site-filter">Location</label>
          <select
            id="site-filter"
            value={selectedSiteId}
            onChange={(e) => onSiteChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All locations</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as AssetStatus | 'all')}
            className="filter-select"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="search-input">Search</label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assets..."
            className="filter-input"
          />
        </div>
      </div>

      <div className="filters-right">
        <button onClick={onNewAsset} className="btn btn-primary">
          + New Asset
        </button>
      </div>
    </div>
  );
};
