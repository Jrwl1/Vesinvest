import React, { useState, useEffect, useCallback } from 'react';
import {
  analyzeForAutoExtract,
  autoExtract,
  listAssetTypes,
  listSites,
} from '../api';
import type {
  AutoExtractAnalysis,
  AutoExtractResult,
  SheetDefaults,
  AssetType,
  Site,
  Criticality,
} from '../types';

interface AutoExtractProps {
  importId: string;
  sheetId: string;
  sheetName: string;
  rowCount: number;
  onComplete: (result: AutoExtractResult) => void;
  onBack: () => void;
}

export const AutoExtract: React.FC<AutoExtractProps> = ({
  importId,
  sheetId,
  sheetName,
  rowCount,
  onComplete,
  onBack,
}) => {
  const [analysis, setAnalysis] = useState<AutoExtractAnalysis | null>(null);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sheet defaults form
  const [assetType, setAssetType] = useState<string>('');
  const [site, setSite] = useState<string>('');
  const [lifeYears, setLifeYears] = useState<number>(20);
  const [replacementCostEur, setReplacementCostEur] = useState<number | undefined>(undefined);
  const [criticality, setCriticality] = useState<Criticality>('medium');
  const [allowFallbackIdentity, setAllowFallbackIdentity] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [analysisResult, types, siteList] = await Promise.all([
        analyzeForAutoExtract(importId, sheetId),
        listAssetTypes(),
        listSites(),
      ]);
      setAnalysis(analysisResult);
      setAssetTypes(types);
      setSites(siteList);

      // Auto-select suggested asset type
      if (analysisResult.suggestedAssetType) {
        setAssetType(analysisResult.suggestedAssetType);
      } else if (types.length > 0) {
        setAssetType(types[0].code);
      }

      // Auto-select site if only one
      if (siteList.length === 1) {
        setSite(siteList[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze sheet');
    } finally {
      setLoading(false);
    }
  }, [importId, sheetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePreview = async () => {
    if (!assetType) {
      setError('Please select an asset type');
      return;
    }

    try {
      setExecuting(true);
      setError(null);
      const defaults: SheetDefaults = {
        assetType,
        site: site || undefined,
        lifeYears,
        replacementCostEur,
        criticality,
      };
      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: true,
        allowFallbackIdentity,
      });
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = async () => {
    if (!assetType) {
      setError('Please select an asset type');
      return;
    }

    try {
      setExecuting(true);
      setError(null);
      const defaults: SheetDefaults = {
        assetType,
        site: site || undefined,
        lifeYears,
        replacementCostEur,
        criticality,
      };
      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: false,
        allowFallbackIdentity,
      });
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="auto-extract">
        <div className="loading-spinner">Analyzing sheet...</div>
      </div>
    );
  }

  return (
    <div className="auto-extract">
      <div className="auto-extract-header">
        <h3>Quick Import: {sheetName}</h3>
        <p className="hint">
          Auto-detect columns and apply sheet-level defaults. Best for consistent data.
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-small">
            Dismiss
          </button>
        </div>
      )}

      {analysis && !analysis.canAutoExtract && (
        <div className="warning-banner">
          <strong>Cannot auto-extract:</strong> {analysis.issues.join(', ')}
          <p>Please use the full mapping editor instead.</p>
        </div>
      )}

      {analysis && analysis.canAutoExtract && (
        <>
          {/* Detected Columns */}
          <div className="detected-columns">
            <h4>Detected Columns</h4>
            <div className="columns-grid-auto">
              {Object.entries(analysis.detectedColumns).map(([field, column]) => (
                <div
                  key={field}
                  className={`column-detection ${column ? 'detected' : 'not-detected'}`}
                >
                  <span className="field-name">{field}</span>
                  {column ? (
                    <span className="column-name">← {column}</span>
                  ) : (
                    <span className="no-column">Will use default</span>
                  )}
                </div>
              ))}
            </div>
            {analysis.issues.length > 0 && (
              <div className="detection-issues">
                {analysis.issues.map((issue, idx) => (
                  <p key={idx} className="issue-note">{issue}</p>
                ))}
              </div>
            )}
          </div>

          {/* Sheet Defaults Form */}
          <div className="sheet-defaults-form">
            <h4>Sheet-Level Defaults</h4>
            <p className="hint">These values apply to all {rowCount} rows in this sheet.</p>

            <div className="form-grid">
              <div className="form-group required">
                <label htmlFor="assetType">Asset Type *</label>
                <select
                  id="assetType"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  required
                >
                  <option value="">Select asset type...</option>
                  {assetTypes.map((at) => (
                    <option key={at.id} value={at.code}>
                      {at.name} ({at.code})
                    </option>
                  ))}
                </select>
                {analysis.suggestedAssetType && (
                  <span className="suggested-hint">
                    Suggested: {analysis.suggestedAssetType}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="site">Site</label>
                <select
                  id="site"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                >
                  <option value="">
                    {sites.length === 1 ? sites[0].name : 'Select site...'}
                  </option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="lifeYears">Default Lifetime (years)</label>
                <input
                  id="lifeYears"
                  type="number"
                  min="1"
                  max="100"
                  value={lifeYears}
                  onChange={(e) => setLifeYears(parseInt(e.target.value, 10) || 20)}
                />
                <span className="field-hint">
                  Used when Excel has no lifetime column
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="replacementCost">Default Replacement Cost (€)</label>
                <input
                  id="replacementCost"
                  type="number"
                  min="0"
                  step="100"
                  value={replacementCostEur ?? ''}
                  onChange={(e) =>
                    setReplacementCostEur(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="Leave empty for no default"
                />
                <span className="field-hint">
                  Optional. Leave blank if Excel has cost data.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="criticality">Default Criticality</label>
                <select
                  id="criticality"
                  value={criticality}
                  onChange={(e) => setCriticality(e.target.value as Criticality)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowFallbackIdentity}
                    onChange={(e) => setAllowFallbackIdentity(e.target.checked)}
                  />
                  Allow fallback identity when externalRef is missing
                </label>
                <span className="field-hint">
                  If unchecked, rows without externalRef will be skipped.
                </span>
              </div>
            </div>
          </div>

          {/* Preview Results */}
          {previewResult && (
            <div className="preview-results">
              <h4>Import Preview</h4>
              
              {/* Info Messages - e.g., "Numeric identifiers detected and normalized" */}
              {previewResult.infoMessages && previewResult.infoMessages.length > 0 && (
                <div className="preview-info-messages">
                  {previewResult.infoMessages.map((msg, idx) => (
                    <div key={idx} className="info-message">
                      <span className="info-icon">ℹ️</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="preview-counts">
                <div className="count-card create">
                  <div className="count-value">{previewResult.created}</div>
                  <div className="count-label">Will Create</div>
                </div>
                <div className="count-card update">
                  <div className="count-value">{previewResult.updated}</div>
                  <div className="count-label">Will Update</div>
                </div>
                <div className="count-card skip">
                  <div className="count-value">
                    {previewResult.unchanged + previewResult.skipped}
                  </div>
                  <div className="count-label">Will Skip</div>
                </div>
                {previewResult.derivedIdentityCount > 0 && (
                  <div className="count-card warning">
                    <div className="count-value">{previewResult.derivedIdentityCount}</div>
                    <div className="count-label">Fallback ID</div>
                  </div>
                )}
              </div>

              {previewResult.assumedFields.length > 0 && (
                <div className="assumed-fields-report">
                  <h5>Fields Using Defaults</h5>
                  <table className="assumed-fields-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Value</th>
                        <th>Source</th>
                        <th>Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResult.assumedFields.map((stat, idx) => (
                        <tr key={idx}>
                          <td>{stat.field}</td>
                          <td>{stat.value}</td>
                          <td>
                            <span className={`source-badge ${stat.source}`}>
                              {stat.source === 'sheet-default' ? 'Sheet Default' : 'Asset Type Default'}
                            </span>
                          </td>
                          <td>{stat.rowCount} row(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewResult.sampleErrors.length > 0 && (
                <div className="preview-errors">
                  <h5>Issues Found</h5>
                  <ul>
                    {previewResult.sampleErrors.map((err, idx) => (
                      <li key={idx}>
                        <strong>Row {err.row}:</strong> {err.message}
                      </li>
                    ))}
                  </ul>
                  {previewResult.errors.length > previewResult.sampleErrors.length && (
                    <p className="more-errors">
                      ...and {previewResult.errors.length - previewResult.sampleErrors.length} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="auto-extract-actions">
            <button className="btn btn-secondary" onClick={onBack}>
              Back
            </button>
            {!previewResult ? (
              <button
                className="btn btn-primary"
                onClick={handlePreview}
                disabled={executing || !assetType}
              >
                {executing ? 'Analyzing...' : 'Preview Import'}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPreviewResult(null)}
                >
                  Edit Defaults
                </button>
                <button
                  className="btn btn-primary btn-success"
                  onClick={handleExecute}
                  disabled={executing || previewResult.errors.length > 0}
                >
                  {executing ? 'Importing...' : `Import ${previewResult.created + previewResult.updated} Assets`}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
