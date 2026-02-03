import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type { Asset, Site, AssetStatus } from '../types';
import { FiltersBar } from '../components/FiltersBar';
import { AssetsTable } from '../components/AssetsTable';
import { AssetOverview } from '../components/AssetOverview';
import { useNavigation } from '../context/NavigationContext';

type ViewMode = 'overview' | 'table';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export const AssetsPage: React.FC = () => {
  const { navigateToAsset } = useNavigation();

  // View mode - default to overview for better first impression
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // Data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const data = await api<Site[]>('/sites');
        setSites(data);
      } catch (err) {
        console.error('Failed to fetch sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Fetch assets when filters change
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedSiteId) {
        params.set('siteId', selectedSiteId);
      }
      if (selectedStatus !== 'all') {
        params.set('status', selectedStatus);
      }
      if (debouncedSearch.trim()) {
        params.set('q', debouncedSearch.trim());
      }

      const queryString = params.toString();
      const path = queryString ? `/assets?${queryString}` : '/assets';
      const data = await api<Asset[]>(path);
      setAssets(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assets';
      setError(message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId, selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleNewAsset = () => {
    // TODO: Open modal or navigate to create page
    alert('New Asset form coming soon!');
  };

  return (
    <div className="assets-page">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Your Infrastructure</h2>
          <span className="asset-count">
            {loading ? '...' : `${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
            title="Overview - grouped by site with urgency"
          >
            Overview
          </button>
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Table - detailed spreadsheet view"
          >
            Table
          </button>
        </div>
      </div>

      {/* Only show filters bar in table mode */}
      {viewMode === 'table' && (
        <FiltersBar
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSiteChange={setSelectedSiteId}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewAsset={handleNewAsset}
        />
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button onClick={fetchAssets} className="btn btn-small">
            Retry
          </button>
        </div>
      )}

      {viewMode === 'overview' ? (
        <AssetOverview 
          assets={assets} 
          sites={sites}
          loading={loading} 
          onAssetClick={navigateToAsset} 
        />
      ) : (
        <AssetsTable 
          assets={assets} 
          loading={loading} 
          onAssetClick={navigateToAsset} 
        />
      )}
    </div>
  );
};
