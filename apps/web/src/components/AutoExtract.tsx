import React, { useState, useEffect, useCallback } from 'react';
import {
  analyzeForAutoExtract,
  autoExtract,
  listAssetTypes,
  listSites,
  createSite,
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

type SiteSelectionMode = 'auto' | 'manual';

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
  const [lifeYears, setLifeYears] = useState<number>(20);
  const [replacementCostEur, setReplacementCostEur] = useState<number | undefined>(undefined);
  const [criticality, setCriticality] = useState<Criticality>('medium');
  const [allowFallbackIdentity, setAllowFallbackIdentity] = useState(true);

  // Site selection state
  const [siteSelectionMode, setSiteSelectionMode] = useState<SiteSelectionMode>('auto');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [creatingSite, setCreatingSite] = useState(false);

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

      // Determine initial site selection mode
      if (siteList.length === 0) {
        // No sites exist - force manual mode with create
        setSiteSelectionMode('manual');
        setShowCreateSite(true);
      } else if (analysisResult.needsSiteSelection || analysisResult.detectedSites.length === 0) {
        // No valid sites detected from file - use manual mode
        setSiteSelectionMode('manual');
        if (siteList.length === 1) {
          setSelectedSiteId(siteList[0].id);
        }
      } else if (analysisResult.unknownSites.length > 0) {
        // Unknown sites detected - user needs to decide
        setSiteSelectionMode('auto');
      } else if (analysisResult.detectedSites.length > 0) {
        // Valid sites detected - default to auto mode
        setSiteSelectionMode('auto');
      } else {
        // Fallback to manual
        setSiteSelectionMode('manual');
        if (siteList.length === 1) {
          setSelectedSiteId(siteList[0].id);
        }
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

  const handleCreateSite = async () => {
    if (!newSiteName.trim()) {
      setError('Please enter a site name');
      return;
    }

    try {
      setCreatingSite(true);
      setError(null);
      const newSite = await createSite({ name: newSiteName.trim() });
      setSites((prev) => [...prev, newSite]);
      setSelectedSiteId(newSite.id);
      setShowCreateSite(false);
      setNewSiteName('');
      setSiteSelectionMode('manual');

      // Re-analyze with the new site
      const newAnalysis = await analyzeForAutoExtract(importId, sheetId, newSite.id);
      setAnalysis(newAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setCreatingSite(false);
    }
  };

  // Determine if we can proceed
  const canProceed = () => {
    if (!assetType) return false;
    if (sites.length === 0) return false;

    if (siteSelectionMode === 'manual') {
      return !!selectedSiteId;
    }

    // Auto mode - check if valid sites detected or all sites exist
    if (analysis) {
      if (analysis.detectedSites.length === 0) return false;
      if (analysis.unknownSites.length > 0) return false;
    }

    return true;
  };

  const handlePreview = async () => {
    if (!canProceed()) {
      if (!selectedSiteId && siteSelectionMode === 'manual') {
        setError('Please select a location for these assets');
      }
      return;
    }

    try {
      setExecuting(true);
      setError(null);

      const defaults: SheetDefaults = {
        assetType,
        lifeYears,
        replacementCostEur,
        criticality,
      };

      // Determine site
      let siteOverrideId: string | undefined;
      if (siteSelectionMode === 'manual' && selectedSiteId) {
        siteOverrideId = selectedSiteId;
      } else if (siteSelectionMode === 'auto' && analysis?.detectedSites.length === 1) {
        // Single detected site - find its ID
        const detectedSiteName = analysis.detectedSites[0];
        const matchedSite = sites.find(
          (s) => s.name.toLowerCase() === detectedSiteName.toLowerCase()
        );
        if (matchedSite) {
          siteOverrideId = matchedSite.id;
        }
      }

      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: true,
        allowFallbackIdentity,
        siteOverrideId,
      });
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = async () => {
    if (!canProceed()) return;

    try {
      setExecuting(true);
      setError(null);

      const defaults: SheetDefaults = {
        assetType,
        lifeYears,
        replacementCostEur,
        criticality,
      };

      // Determine site
      let siteOverrideId: string | undefined;
      if (siteSelectionMode === 'manual' && selectedSiteId) {
        siteOverrideId = selectedSiteId;
      } else if (siteSelectionMode === 'auto' && analysis?.detectedSites.length === 1) {
        const detectedSiteName = analysis.detectedSites[0];
        const matchedSite = sites.find(
          (s) => s.name.toLowerCase() === detectedSiteName.toLowerCase()
        );
        if (matchedSite) {
          siteOverrideId = matchedSite.id;
        }
      }

      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: false,
        allowFallbackIdentity,
        siteOverrideId,
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

  // Show create site UI when no sites exist
  if (sites.length === 0) {
    return (
      <div className="auto-extract">
        <div className="auto-extract-header">
          <h3>Create Your First Location</h3>
          <p className="hint">
            Before importing assets, you need to create at least one location (site) where these
            assets belong.
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

        <div className="create-first-site">
          <div className="form-group">
            <label htmlFor="newSiteName">Location Name *</label>
            <input
              id="newSiteName"
              type="text"
              placeholder="e.g., Water Treatment Facility, Pump Station 1"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateSite}
            disabled={!newSiteName.trim() || creatingSite}
          >
            {creatingSite ? 'Creating...' : 'Create Location & Continue'}
          </button>
        </div>

        <div className="site-resolution-footer">
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auto-extract">
      <div className="auto-extract-header">
        <h3>Quick Import: {sheetName}</h3>
        <p className="hint">
          Auto-detect columns and apply defaults. 
          {analysis?.dataRowDetection.skippedRows 
            ? ` (Skipped ${analysis.dataRowDetection.skippedRows} header row${analysis.dataRowDetection.skippedRows > 1 ? 's' : ''})` 
            : ''}
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
          {/* Location Selection - Always shown first */}
          <div className="site-selection-section">
            <h4>Location for these assets</h4>
            
            {/* Show detected sites info if any */}
            {analysis.detectedSites.length > 0 && analysis.unknownSites.length === 0 && (
              <div className="detected-sites-info">
                <span className="detected-badge">✓ Locations found in file:</span>
                <span className="detected-list">
                  {analysis.detectedSites.slice(0, 3).join(', ')}
                  {analysis.detectedSites.length > 3 && ` (+${analysis.detectedSites.length - 3} more)`}
                </span>
              </div>
            )}

            {/* Show mode toggle if we have valid detected sites */}
            {analysis.detectedSites.length > 0 && analysis.unknownSites.length === 0 && (
              <div className="site-mode-toggle">
                <label className="toggle-option">
                  <input
                    type="radio"
                    name="siteMode"
                    checked={siteSelectionMode === 'auto'}
                    onChange={() => setSiteSelectionMode('auto')}
                  />
                  <span>Use locations from file</span>
                </label>
                <label className="toggle-option">
                  <input
                    type="radio"
                    name="siteMode"
                    checked={siteSelectionMode === 'manual'}
                    onChange={() => setSiteSelectionMode('manual')}
                  />
                  <span>Put everything under one location</span>
                </label>
              </div>
            )}

            {/* Show message if no valid sites detected from file */}
            {(analysis.needsSiteSelection || analysis.detectedSites.length === 0) && (
              <p className="site-help-text">
                No locations detected in this file. Choose where these assets belong.
              </p>
            )}

            {/* Show warning if unknown sites detected */}
            {analysis.unknownSites.length > 0 && siteSelectionMode === 'auto' && (
              <div className="unknown-sites-warning">
                <strong>New locations found:</strong> {analysis.unknownSites.join(', ')}
                <p>
                  These locations don't exist in your system. You can either create them first,
                  or put all assets under one existing location.
                </p>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => setSiteSelectionMode('manual')}
                >
                  Use one location for all
                </button>
              </div>
            )}

            {/* Manual site selection dropdown */}
            {(siteSelectionMode === 'manual' || analysis.needsSiteSelection || analysis.detectedSites.length === 0) && (
              <div className="manual-site-select">
                {!showCreateSite ? (
                  <>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className={!selectedSiteId ? 'placeholder' : ''}
                    >
                      <option value="">Select a location...</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setShowCreateSite(true)}
                    >
                      + Create New
                    </button>
                  </>
                ) : (
                  <div className="inline-create-site">
                    <input
                      type="text"
                      placeholder="New location name..."
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                    />
                    <button
                      className="btn btn-small btn-primary"
                      onClick={handleCreateSite}
                      disabled={!newSiteName.trim() || creatingSite}
                    >
                      {creatingSite ? '...' : 'Create'}
                    </button>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => {
                        setShowCreateSite(false);
                        setNewSiteName('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detected Columns */}
          <div className="detected-columns">
            <h4>Detected Columns</h4>
            <div className="columns-grid-auto">
              {Object.entries(analysis.detectedColumns)
                .filter(([field]) => field !== 'siteId')
                .map(([field, column]) => (
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
            {analysis.issues.filter(i => !i.includes('location')).length > 0 && (
              <div className="detection-issues">
                {analysis.issues
                  .filter(i => !i.includes('location'))
                  .map((issue, idx) => (
                    <p key={idx} className="issue-note">{issue}</p>
                  ))}
              </div>
            )}
          </div>

          {/* Sheet Defaults Form */}
          <div className="sheet-defaults-form">
            <h4>Import Settings</h4>
            <p className="hint">
              These values apply to all {analysis.dataRowCount || rowCount} data rows.
            </p>

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
                  <span className="suggested-hint">Suggested: {analysis.suggestedAssetType}</span>
                )}
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
                <span className="field-hint">Used when Excel has no lifetime column</span>
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
                  Allow fallback identity when ID is missing
                </label>
                <span className="field-hint">If unchecked, rows without ID will be skipped.</span>
              </div>
            </div>
          </div>

          {/* Preview Results */}
          {previewResult && (
            <div className="preview-results">
              <h4>Import Preview</h4>

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
                disabled={executing || !canProceed()}
              >
                {executing ? 'Analyzing...' : 'Preview Import'}
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setPreviewResult(null)}>
                  Edit Settings
                </button>
                <button
                  className="btn btn-primary btn-success"
                  onClick={handleExecute}
                  disabled={executing || previewResult.errors.length > 0}
                >
                  {executing
                    ? 'Importing...'
                    : `Import ${previewResult.created + previewResult.updated} Assets`}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
