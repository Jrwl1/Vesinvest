import React, { useState, useEffect } from 'react';
import { getSanitySummary } from '../api';
import type { SanitySummary as SanitySummaryType } from '../types';

interface SanitySummaryProps {
  importId: string;
  onClose?: () => void;
}

export const SanitySummary: React.FC<SanitySummaryProps> = ({
  importId,
  onClose,
}) => {
  const [summary, setSummary] = useState<SanitySummaryType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      const data = await getSanitySummary(importId);
      setSummary(data);
      setLoading(false);
    };
    loadSummary();
  }, [importId]);

  if (loading) {
    return (
      <div className="sanity-summary">
        <div className="loading-spinner">Loading import summary...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="sanity-summary">
        <div className="sanity-error">
          <p>Could not load import summary.</p>
          {onClose && (
            <button className="btn btn-primary" onClick={onClose}>
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getUrgencyClass = (overdue: number, upcoming: number, total: number) => {
    if (total === 0) return 'neutral';
    const overdueRatio = overdue / total;
    if (overdueRatio > 0.2) return 'critical';
    if (overdueRatio > 0.1 || upcoming / total > 0.3) return 'warning';
    return 'healthy';
  };

  const urgencyClass = getUrgencyClass(
    summary.ageLifetime.overdueCount,
    summary.ageLifetime.upcomingCount,
    summary.totalAssetsImported
  );

  return (
    <div className="sanity-summary">
      <div className="sanity-header">
        <div className="sanity-title">
          <h3>Import Summary</h3>
          <p className="sanity-subtitle">
            {summary.importFilename} • {formatDate(summary.importedAt)}
          </p>
        </div>
        <div className="sanity-total">
          <span className="total-count">{summary.totalAssetsImported}</span>
          <span className="total-label">Assets Imported</span>
        </div>
      </div>

      {/* Data Quality Notes */}
      {summary.dataQualityNotes.length > 0 && (
        <div className="sanity-notes">
          <h4>Data Quality Notes</h4>
          <ul>
            {summary.dataQualityNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="sanity-grid">
        {/* By Asset Type */}
        <div className="sanity-card">
          <h4>By Asset Type</h4>
          {summary.byAssetType.length === 0 ? (
            <p className="no-data">No data</p>
          ) : (
            <div className="sanity-bars">
              {summary.byAssetType.map((item) => (
                <div key={item.assetTypeId} className="bar-row">
                  <div className="bar-label">
                    <span className="bar-name">{item.assetTypeName}</span>
                    <span className="bar-code">{item.assetTypeCode}</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill type"
                      style={{
                        width: `${(item.count / summary.totalAssetsImported) * 100}%`,
                      }}
                    />
                    <span className="bar-count">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Site */}
        <div className="sanity-card">
          <h4>By Location</h4>
          {summary.bySite.length === 0 ? (
            <p className="no-data">No data</p>
          ) : (
            <div className="sanity-bars">
              {summary.bySite.map((item) => (
                <div key={item.siteId} className="bar-row">
                  <div className="bar-label">
                    <span className="bar-name">{item.siteName}</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill site"
                      style={{
                        width: `${(item.count / summary.totalAssetsImported) * 100}%`,
                      }}
                    />
                    <span className="bar-count">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Installation Decade */}
        <div className="sanity-card">
          <h4>Installation Decade</h4>
          {summary.byDecade.length === 0 ? (
            <p className="no-data">No data</p>
          ) : (
            <div className="decade-chart">
              {summary.byDecade.map((item) => (
                <div key={item.decade} className="decade-bar">
                  <div
                    className="decade-fill"
                    style={{
                      height: `${Math.max(
                        10,
                        (item.count / summary.totalAssetsImported) * 100
                      )}%`,
                    }}
                  />
                  <span className="decade-count">{item.count}</span>
                  <span className="decade-label">{item.decade}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Distribution */}
        <div className="sanity-card">
          <h4>Replacement Cost</h4>
          {summary.costDistribution.assetsWithCost === 0 ? (
            <p className="no-data">No cost data available</p>
          ) : (
            <div className="cost-stats">
              <div className="cost-row">
                <span className="cost-label">Min</span>
                <span className="cost-value">{formatCurrency(summary.costDistribution.min)}</span>
              </div>
              <div className="cost-row">
                <span className="cost-label">Median</span>
                <span className="cost-value highlight">{formatCurrency(summary.costDistribution.median)}</span>
              </div>
              <div className="cost-row">
                <span className="cost-label">Average</span>
                <span className="cost-value">{formatCurrency(summary.costDistribution.average)}</span>
              </div>
              <div className="cost-row">
                <span className="cost-label">Max</span>
                <span className="cost-value">{formatCurrency(summary.costDistribution.max)}</span>
              </div>
              <div className="cost-row">
                <span className="cost-label">P90</span>
                <span className="cost-value">{formatCurrency(summary.costDistribution.p90)}</span>
              </div>
              <div className="cost-coverage">
                {summary.costDistribution.assetsWithCost} of {summary.costDistribution.totalAssets} assets have cost data
              </div>
            </div>
          )}
        </div>

        {/* Age vs Lifetime */}
        <div className="sanity-card wide">
          <h4>Asset Health (Age vs Expected Lifetime)</h4>
          <div className={`health-overview ${urgencyClass}`}>
            <div className="health-stat overdue">
              <span className="health-count">{summary.ageLifetime.overdueCount}</span>
              <span className="health-label">Overdue</span>
            </div>
            <div className="health-stat upcoming">
              <span className="health-count">{summary.ageLifetime.upcomingCount}</span>
              <span className="health-label">Due Soon (≤3 yrs)</span>
            </div>
            <div className="health-stat ok">
              <span className="health-count">{summary.ageLifetime.okCount}</span>
              <span className="health-label">OK</span>
            </div>
            {summary.ageLifetime.unknownCount > 0 && (
              <div className="health-stat unknown">
                <span className="health-count">{summary.ageLifetime.unknownCount}</span>
                <span className="health-label">Unknown</span>
              </div>
            )}
          </div>

          {summary.ageLifetime.ageDistribution.length > 0 && (
            <div className="age-distribution">
              <h5>Age as % of Expected Lifetime</h5>
              <div className="distribution-bars">
                {summary.ageLifetime.ageDistribution.map((item) => (
                  <div key={item.bucket} className="dist-bar">
                    <div
                      className={`dist-fill ${item.bucket === '100%+' ? 'overdue' : ''}`}
                      style={{
                        height: `${Math.max(
                          5,
                          (item.count / summary.totalAssetsImported) * 150
                        )}%`,
                      }}
                    />
                    <span className="dist-count">{item.count}</span>
                    <span className="dist-label">{item.bucket}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(summary.ageLifetime.averageAge !== null || summary.ageLifetime.averageLifeYears !== null) && (
            <div className="age-averages">
              {summary.ageLifetime.averageAge !== null && (
                <span>Average age: <strong>{summary.ageLifetime.averageAge} years</strong></span>
              )}
              {summary.ageLifetime.averageLifeYears !== null && (
                <span>Average expected life: <strong>{summary.ageLifetime.averageLifeYears} years</strong></span>
              )}
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <div className="sanity-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Continue to Assets
          </button>
        </div>
      )}
    </div>
  );
};
