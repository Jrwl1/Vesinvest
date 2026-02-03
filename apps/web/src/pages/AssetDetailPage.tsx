import React, { useEffect, useState, useCallback } from 'react';
import { getAsset, listMaintenanceItems, createMaintenanceItem } from '../api';
import { useNavigation } from '../context/NavigationContext';
import type { Asset, MaintenanceItem, CreateMaintenanceItemPayload, MaintenanceKind } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { AddMaintenanceItemModal } from '../components/AddMaintenanceItemModal';

interface AssetDetailPageProps {
  assetId: string;
}

export const AssetDetailPage: React.FC<AssetDetailPageProps> = ({ assetId }) => {
  const { navigateBack } = useNavigation();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch asset and maintenance items
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [assetData, itemsData] = await Promise.all([
        getAsset(assetId),
        listMaintenanceItems(assetId),
      ]);
      setAsset(assetData);
      setMaintenanceItems(itemsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load asset';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle maintenance item creation
  const handleAddItem = async (data: {
    kind: MaintenanceKind;
    intervalYears: number;
    costEur: number;
    startsAtYear?: number;
    notes?: string;
  }) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateMaintenanceItemPayload = {
        assetId,
        kind: data.kind,
        intervalYears: data.intervalYears,
        costEur: data.costEur,
        startsAtYear: data.startsAtYear,
        notes: data.notes,
      };

      await createMaintenanceItem(payload);

      // Refetch maintenance items
      const items = await listMaintenanceItems(assetId);
      setMaintenanceItems(items);

      setShowModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create maintenance item';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="asset-detail-page">
        <div className="breadcrumb">
          <button onClick={navigateBack} className="breadcrumb-link">
            ← Assets
          </button>
        </div>
        <div className="loading-state">Loading asset...</div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="asset-detail-page">
        <div className="breadcrumb">
          <button onClick={navigateBack} className="breadcrumb-link">
            ← Assets
          </button>
        </div>
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error ?? 'Asset not found'}</span>
          <button onClick={fetchData} className="btn btn-small">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate effective values
  const effectiveLifeYears = asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? null;
  const installedYear = asset.installedOn
    ? new Date(asset.installedOn).getUTCFullYear()
    : null;
  const expectedReplacementYear =
    installedYear && effectiveLifeYears ? installedYear + effectiveLifeYears : null;

  return (
    <div className="asset-detail-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button onClick={navigateBack} className="breadcrumb-link">
          ← Assets
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{asset.name}</span>
      </div>

      {/* Asset Info Card */}
      <div className="detail-card">
        <div className="detail-card-header">
          <h2>{asset.name}</h2>
          <span className={`status-badge status-${asset.status}`}>{asset.status}</span>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Location</span>
            <span className="detail-value">{asset.site?.name ?? '—'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Type</span>
            <span className="detail-value">{asset.assetType?.name ?? '—'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">External Ref</span>
            <span className="detail-value">{asset.externalRef ?? '—'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Criticality</span>
            <span className={`criticality-badge criticality-${asset.criticality}`}>
              {asset.criticality}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Installed On</span>
            <span className="detail-value">{formatDate(asset.installedOn)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Life Years</span>
            <span className="detail-value">
              {effectiveLifeYears ?? '—'}
              {asset.lifeYears === null && asset.assetType?.defaultLifeYears && (
                <span className="detail-hint"> (from type)</span>
              )}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Expected Replacement</span>
            <span className="detail-value">
              {expectedReplacementYear ?? '—'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Replacement Cost</span>
            <span className="detail-value">{formatCurrency(asset.replacementCostEur)}</span>
          </div>
        </div>

        {asset.notes && (
          <div className="detail-notes">
            <span className="detail-label">Notes</span>
            <p>{asset.notes}</p>
          </div>
        )}
      </div>

      {/* Maintenance Plan Section */}
      <div className="detail-section">
        <div className="section-header">
          <h3>Maintenance Plan</h3>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            + Add Item
          </button>
        </div>

        {maintenanceItems.length === 0 ? (
          <div className="empty-state">
            No maintenance items defined for this asset.
          </div>
        ) : (
          <div className="table-container">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Interval</th>
                  <th className="num">Cost</th>
                  <th className="num">Starts</th>
                  <th className="num">Ends</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`kind-badge kind-${item.kind.toLowerCase()}`}>
                        {item.kind}
                      </span>
                    </td>
                    <td className="num">
                      {item.kind === 'MAINTENANCE'
                        ? `Every ${item.intervalYears} yr${item.intervalYears > 1 ? 's' : ''}`
                        : '—'}
                    </td>
                    <td className="num">{formatCurrency(item.costEur)}</td>
                    <td className="num">{item.startsAtYear ?? '—'}</td>
                    <td className="num">{item.endsAtYear ?? '—'}</td>
                    <td className="notes-cell">{item.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Maintenance Item Modal */}
      {showModal && (
        <AddMaintenanceItemModal
          onClose={() => {
            setShowModal(false);
            setSubmitError(null);
          }}
          onSubmit={handleAddItem}
          submitting={submitting}
          error={submitError}
        />
      )}
    </div>
  );
};
