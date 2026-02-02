import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type { Asset, Site, AssetStatus } from '../types';
import { FiltersBar } from '../components/FiltersBar';
import { AssetsTable } from '../components/AssetsTable';
import { useNavigation } from '../context/NavigationContext';

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
        <h2>Assets</h2>
        <span className="asset-count">
          {loading ? '...' : `${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
        </span>
      </div>

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

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button onClick={fetchAssets} className="btn btn-small">
            Retry
          </button>
        </div>
      )}

      <AssetsTable assets={assets} loading={loading} onAssetClick={navigateToAsset} />
    </div>
  );
};
