import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Site, Asset, AssetStatus } from '../types';
import { formatCurrency, formatDate, isWithinYears } from '../utils/format';

interface SiteCardProps {
  site: Site;
  assetCount: number;
  statusFilter: AssetStatus | 'all';
  searchQuery: string;
  onAssetClick: (assetId: string) => void;
}

// Cache for site assets
const assetsCache = new Map<string, { assets: Asset[]; status: AssetStatus | 'all' }>();

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  assetCount,
  statusFilter,
  searchQuery,
  onAssetClick,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${site.id}-${statusFilter}`;

  const fetchAssets = useCallback(async () => {
    // Check cache first
    const cached = assetsCache.get(cacheKey);
    if (cached && cached.status === statusFilter) {
      setAssets(cached.assets);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('siteId', site.id);
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const data = await api<Asset[]>(`/assets?${params.toString()}`);
      setAssets(data);
      assetsCache.set(cacheKey, { assets: data, status: statusFilter });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [site.id, statusFilter, cacheKey]);

  // Fetch assets when expanded
  useEffect(() => {
    if (expanded) {
      fetchAssets();
    }
  }, [expanded, fetchAssets]);

  // Clear cache when status filter changes
  useEffect(() => {
    const cached = assetsCache.get(cacheKey);
    if (cached && cached.status !== statusFilter) {
      assetsCache.delete(cacheKey);
    }
  }, [statusFilter, cacheKey]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Client-side search filtering
  const filteredAssets = searchQuery.trim()
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.externalRef?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : assets;

  return (
    <div className={`site-card ${expanded ? 'expanded' : ''}`}>
      <div className="site-card-header" onClick={toggleExpanded}>
        <div className="site-card-toggle">
          <span className="toggle-icon">{expanded ? '▼' : '▶'}</span>
        </div>
        <div className="site-card-info">
          <h3 className="site-name">{site.name}</h3>
          {site.address && <p className="site-address">{site.address}</p>}
        </div>
        <div className="site-card-meta">
          <span className="asset-count-badge">{assetCount} assets</span>
        </div>
      </div>

      {expanded && (
        <div className="site-card-content">
          {loading && <div className="site-assets-loading">Loading assets...</div>}

          {error && (
            <div className="site-assets-error">
              {error}
              <button onClick={fetchAssets} className="btn btn-small">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredAssets.length === 0 && (
            <div className="site-assets-empty">
              {searchQuery ? 'No matching assets found.' : 'No assets at this location.'}
            </div>
          )}

          {!loading && !error && filteredAssets.length > 0 && (
            <table className="site-assets-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Installed</th>
                  <th className="num">Repl. Year</th>
                  <th className="num">Repl. Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onClick={() => onAssetClick(asset.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

interface AssetRowProps {
  asset: Asset;
  onClick: () => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, onClick }) => {
  const replacementYear = asset.expectedReplacementYear;
  const isReplacementSoon = isWithinYears(replacementYear, 2);

  return (
    <tr
      className={`clickable-row ${isReplacementSoon ? 'row-warning' : ''}`}
      onClick={onClick}
    >
      <td>
        <span className="asset-name">{asset.name}</span>
        {asset.externalRef && (
          <span className="asset-ref">{asset.externalRef}</span>
        )}
      </td>
      <td>{asset.assetType?.name ?? '—'}</td>
      <td>{formatDate(asset.installedOn)}</td>
      <td className="num">
        {replacementYear ? (
          <>
            {replacementYear}
            {isReplacementSoon && <span className="badge-warning">Soon</span>}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="num">{formatCurrency(asset.replacementCostEur)}</td>
      <td>
        <span className={`status-badge status-${asset.status}`}>
          {asset.status}
        </span>
      </td>
    </tr>
  );
};

// Export function to clear cache (useful when data changes)
export function clearSiteAssetsCache() {
  assetsCache.clear();
}
