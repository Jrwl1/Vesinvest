import React from 'react';
import type { Asset } from '../types';
import { formatCurrency, formatDate, formatStatus, isWithinYears } from '../utils/format';

interface AssetsTableProps {
  assets: Asset[];
  loading: boolean;
  onAssetClick?: (assetId: string) => void;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({ assets, loading, onAssetClick }) => {
  if (loading) {
    return <div className="table-loading">Loading assets...</div>;
  }

  if (assets.length === 0) {
    return <div className="table-empty">No assets found.</div>;
  }

  return (
    <div className="table-container">
      <table className="assets-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Site</th>
            <th>Type</th>
            <th>Installed</th>
            <th className="num">Life (yrs)</th>
            <th className="num">Repl. Year</th>
            <th className="num">Repl. Cost</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onClick={onAssetClick ? () => onAssetClick(asset.id) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface AssetRowProps {
  asset: Asset;
  onClick?: () => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, onClick }) => {
  const replacementYear = asset.expectedReplacementYear;
  const isReplacementSoon = isWithinYears(replacementYear, 2);
  const isClickable = !!onClick;

  return (
    <tr
      className={`${isReplacementSoon ? 'row-warning' : ''} ${isClickable ? 'clickable-row' : ''}`}
      onClick={onClick}
    >
      <td className="cell-name">
        <span className="asset-name">{asset.name}</span>
        <span className={`asset-ref ${asset.derivedIdentity ? 'derived-identity' : ''}`}>
          {asset.externalRef}
          {asset.derivedIdentity && (
            <span className="derived-badge" title="This asset has an auto-generated identity that should be replaced with a real ID">
              ⚠️ Derived
            </span>
          )}
        </span>
      </td>
      <td>{asset.site?.name ?? '—'}</td>
      <td>{asset.assetType?.name ?? '—'}</td>
      <td>{formatDate(asset.installedOn)}</td>
      <td className="num">{asset.effectiveLifeYears ?? '—'}</td>
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
          {formatStatus(asset.status)}
        </span>
      </td>
    </tr>
  );
};
