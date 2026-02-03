import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import type { Site, Asset, AssetStatus } from '../types';
import { SiteCard, clearSiteAssetsCache } from '../components/SiteCard';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface SiteWithCount extends Site {
  assetCount: number;
}

export const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<SiteWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch sites with asset counts
  useEffect(() => {
    const fetchSitesWithCounts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch sites and all assets in parallel
        const [sitesData, assetsData] = await Promise.all([
          api<Site[]>('/sites'),
          api<Asset[]>('/assets'),
        ]);

        // Count assets per site
        const countMap = new Map<string, number>();
        for (const asset of assetsData) {
          countMap.set(asset.siteId, (countMap.get(asset.siteId) ?? 0) + 1);
        }

        const sitesWithCounts: SiteWithCount[] = sitesData.map((site) => ({
          ...site,
          assetCount: countMap.get(site.id) ?? 0,
        }));

        setSites(sitesWithCounts);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load sites';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSitesWithCounts();
  }, []);

  // Clear cache when status filter changes
  useEffect(() => {
    clearSiteAssetsCache();
  }, [statusFilter]);

  const handleAssetClick = (assetId: string) => {
    console.log('Asset clicked:', assetId);
    // TODO: Navigate to asset detail page
  };

  // Filter sites by search (matches site name or address)
  const filteredSites = useMemo(() => {
    if (!debouncedSearch.trim()) return sites;
    const query = debouncedSearch.toLowerCase();
    return sites.filter(
      (site) =>
        site.name.toLowerCase().includes(query) ||
        site.address?.toLowerCase().includes(query)
    );
  }, [sites, debouncedSearch]);

  if (loading) {
    return (
      <div className="sites-page">
        <div className="page-header">
          <h2>Locations</h2>
        </div>
        <div className="loading-state">Loading locations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sites-page">
        <div className="page-header">
          <h2>Locations</h2>
        </div>
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="btn btn-small">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sites-page">
      <div className="page-header">
        <h2>Locations</h2>
        <span className="site-count">
          {filteredSites.length} location{filteredSites.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="sites-filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Asset Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search locations or assets..."
            className="filter-input"
          />
        </div>
      </div>

      {filteredSites.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? 'No locations match your search.' : 'No locations found.'}
        </div>
      ) : (
        <div className="sites-list">
          {filteredSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              assetCount={site.assetCount}
              statusFilter={statusFilter}
              searchQuery={debouncedSearch}
              onAssetClick={handleAssetClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
