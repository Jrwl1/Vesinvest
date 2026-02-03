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
  /** When provided, show "Choose a different sheet" in Advanced */
  onChooseDifferentSheet?: () => void;
}

type LocationMode = 'from-file' | 'one-location';

/** Human-friendly title: "Import pipes from X" when asset type suggests pipes, else "Import assets from X" */
function getImportTitle(sheetName: string, suggestedAssetType: string | null): string {
  const lower = (suggestedAssetType || '').toLowerCase();
  if (lower.includes('pipe') || lower.includes('ledning') || lower.includes('line')) {
    return `Import pipes from ${sheetName}`;
  }
  return `Import assets from ${sheetName}`;
}

/** Rewrite technical backend messages for calm, user-facing copy */
function humanizeInfoMessage(msg: string): string {
  if (msg.includes('Numeric identifiers') && msg.includes('normalized')) {
    return 'Numeric IDs in your file were converted to a standard format.';
  }
  if (msg.includes('fallback') && msg.includes('generated')) {
    return 'Some rows are missing an ID; we can generate one for each if you enable it below.';
  }
  if (msg.includes('Skipped') && msg.includes('header')) {
    return msg; // Keep as-is for Advanced
  }
  return msg;
}

// ─── 1) Import Summary ─────────────────────────────────────────────────────
function ImportSummary({
  sheetName,
  dataRowCount,
  suggestedAssetType,
}: {
  sheetName: string;
  dataRowCount: number;
  suggestedAssetType: string | null;
}) {
  const title = getImportTitle(sheetName, suggestedAssetType);
  const count = dataRowCount > 0 ? dataRowCount : 0;
  return (
    <header className="import-summary-header">
      <h2 className="import-summary-title">{title}</h2>
      <p className="import-summary-subtext">
        {count} {count === 1 ? 'asset' : 'assets'} detected
      </p>
      <p className="import-summary-note">
        We'll guide you through location and defaults before importing.
      </p>
    </header>
  );
}

// ─── 2) Location Picker ───────────────────────────────────────────────────
function LocationPicker({
  analysis,
  sites,
  locationMode,
  setLocationMode,
  selectedLocationId,
  setSelectedLocationId,
  showCreateLocation,
  setShowCreateLocation,
  newLocationName,
  setNewLocationName,
  creatingLocation,
  onCreateLocation,
  error,
  setError,
}: {
  analysis: AutoExtractAnalysis | null;
  sites: Site[];
  locationMode: LocationMode;
  setLocationMode: (m: LocationMode) => void;
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  showCreateLocation: boolean;
  setShowCreateLocation: (v: boolean) => void;
  newLocationName: string;
  setNewLocationName: (v: string) => void;
  creatingLocation: boolean;
  onCreateLocation: () => void;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const hasDetectedLocations = (analysis?.detectedSites?.length ?? 0) > 0;
  const hasUnknownLocations = (analysis?.unknownSites?.length ?? 0) > 0;
  const needsChoice = analysis?.needsSiteSelection || !hasDetectedLocations;

  return (
    <section className="location-section" aria-labelledby="location-heading">
      <h3 id="location-heading" className="section-title">
        Location for these assets
      </h3>

      {hasDetectedLocations && !hasUnknownLocations && (
        <div className="location-mode-toggle">
          <label className="radio-option">
            <input
              type="radio"
              name="locationMode"
              checked={locationMode === 'from-file'}
              onChange={() => setLocationMode('from-file')}
            />
            <span>Use locations from your file</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="locationMode"
              checked={locationMode === 'one-location'}
              onChange={() => setLocationMode('one-location')}
            />
            <span>Put everything under one location</span>
          </label>
        </div>
      )}

      {hasDetectedLocations && !hasUnknownLocations && locationMode === 'from-file' && (
        <div className="locations-from-file">
          <span className="locations-badge">Locations found in file:</span>
          <span className="locations-list">
            {analysis!.detectedSites.slice(0, 5).join(', ')}
            {(analysis!.detectedSites.length > 5) && ` (+${analysis!.detectedSites.length - 5} more)`}
          </span>
        </div>
      )}

      {needsChoice && (
        <p className="location-help">
          No locations detected in this file. Choose where these assets belong.
        </p>
      )}

      {hasUnknownLocations && locationMode === 'from-file' && (
        <div className="location-warning-box">
          <strong>New locations in your file:</strong>{' '}
          {analysis!.unknownSites.join(', ')}
          <p>
            These aren't in your system yet. Create them or put all assets under one existing location.
          </p>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => setLocationMode('one-location')}
          >
            Use one location for all
          </button>
        </div>
      )}

      {(locationMode === 'one-location' || needsChoice) && sites.length > 0 && (
        <div className="location-select-row">
          {!showCreateLocation ? (
            <>
              <select
                aria-label="Choose location"
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setError(null);
                }}
                className={`location-select ${!selectedLocationId ? 'placeholder' : ''}`}
              >
                <option value="">Choose a location...</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => setShowCreateLocation(true)}
              >
                Create new location
              </button>
            </>
          ) : (
            <div className="inline-create-location">
              <input
                type="text"
                aria-label="New location name"
                placeholder="New location name..."
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={onCreateLocation}
                disabled={!newLocationName.trim() || creatingLocation}
              >
                {creatingLocation ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => {
                  setShowCreateLocation(false);
                  setNewLocationName('');
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── 3) Assumptions (Missing details we'll fill in) ─────────────────────────
function Assumptions({
  assetTypes,
  suggestedAssetType,
  assetType,
  setAssetType,
  lifeYears,
  setLifeYears,
  replacementCostEur,
  setReplacementCostEur,
  criticality,
  setCriticality,
  allowFallbackIdentity,
  setAllowFallbackIdentity,
  dataRowCount,
}: {
  assetTypes: AssetType[];
  suggestedAssetType: string | null;
  assetType: string;
  setAssetType: (v: string) => void;
  lifeYears: number;
  setLifeYears: (v: number) => void;
  replacementCostEur: number | undefined;
  setReplacementCostEur: (v: number | undefined) => void;
  criticality: Criticality;
  setCriticality: (v: Criticality) => void;
  allowFallbackIdentity: boolean;
  setAllowFallbackIdentity: (v: boolean) => void;
  dataRowCount: number;
}) {
  return (
    <section className="assumptions-section" aria-labelledby="assumptions-heading">
      <h3 id="assumptions-heading" className="section-title">
        Missing details we'll fill in
      </h3>
      <p className="section-hint">
        These apply to all {dataRowCount} rows when the file doesn't include a value.
      </p>

      <div className="assumptions-grid">
        <div className="form-group required">
          <label htmlFor="asset-type">Asset type</label>
          <select
            id="asset-type"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
          >
            <option value="">Select type…</option>
            {assetTypes.map((at) => (
              <option key={at.id} value={at.code}>
                {at.name} {at.code !== at.name ? `(${at.code})` : ''}
              </option>
            ))}
          </select>
          {suggestedAssetType && (
            <span className="form-hint suggested">Suggested: {suggestedAssetType}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lifetime">Lifetime (years)</label>
          <input
            id="lifetime"
            type="number"
            min={1}
            max={100}
            value={lifeYears}
            onChange={(e) => setLifeYears(parseInt(e.target.value, 10) || 20)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="replacement-cost">Replacement cost (€)</label>
          <input
            id="replacement-cost"
            type="number"
            min={0}
            step={100}
            value={replacementCostEur ?? ''}
            onChange={(e) =>
              setReplacementCostEur(e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="Optional"
          />
        </div>

        <div className="form-group">
          <label htmlFor="criticality">Criticality</label>
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

        <div className="form-group checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allowFallbackIdentity}
              onChange={(e) => setAllowFallbackIdentity(e.target.checked)}
            />
            <span>Generate an ID if the file is missing one</span>
          </label>
          <span className="form-hint">If off, rows without an ID will be skipped.</span>
        </div>
      </div>
    </section>
  );
}

// ─── 4) What will happen (Preview) ────────────────────────────────────────
function PreviewOutcome({
  result,
  locationChosen,
  allowFallbackIdentity,
}: {
  result: AutoExtractResult | null;
  locationChosen: boolean;
  allowFallbackIdentity: boolean;
}) {
  if (!result) return null;

  const createCount = result.created ?? 0;
  const updateCount = result.updated ?? 0;
  const skipCount = (result.unchanged ?? 0) + (result.skipped ?? 0);
  const derivedCount = result.derivedIdentityCount ?? 0;
  const hasErrors = (result.errors?.length ?? 0) > 0;

  return (
    <section className="outcome-section" aria-labelledby="outcome-heading">
      <h3 id="outcome-heading" className="section-title">
        What will happen
      </h3>

      {result.infoMessages && result.infoMessages.length > 0 && (
        <div className="outcome-info-box">
          {result.infoMessages.map((msg, idx) => (
            <div key={idx} className="outcome-info-item">
              <span className="outcome-info-icon" aria-hidden>ℹ️</span>
              <span>{humanizeInfoMessage(msg)}</span>
            </div>
          ))}
        </div>
      )}

      {!locationChosen && (
        <p className="outcome-warning-text">No location selected. Choose a location to continue.</p>
      )}

      {locationChosen && derivedCount > 0 && (
        <p className="outcome-warning-text">
          {derivedCount} row{derivedCount !== 1 ? 's' : ''} {derivedCount === 1 ? 'is' : 'are'} missing an ID. {allowFallbackIdentity ? 'They will get a generated ID.' : 'They will be skipped unless you enable ID generation above.'}
        </p>
      )}

      <div className="outcome-cards">
        <div className="outcome-card create">
          <div className="outcome-value">{createCount}</div>
          <div className="outcome-label">Will create</div>
        </div>
        <div className="outcome-card update">
          <div className="outcome-value">{updateCount}</div>
          <div className="outcome-label">Will update</div>
        </div>
        <div className="outcome-card skip">
          <div className="outcome-value">{skipCount}</div>
          <div className="outcome-label">Will skip</div>
        </div>
      </div>

      {hasErrors && result.sampleErrors && result.sampleErrors.length > 0 && (
        <div className="outcome-errors">
          <h4 className="outcome-errors-title">Issues</h4>
          <ul>
            {result.sampleErrors.slice(0, 5).map((err, idx) => (
              <li key={idx}>
                Row {err.row}: {err.message}
              </li>
            ))}
          </ul>
          {result.errors.length > result.sampleErrors.length && (
            <p className="outcome-more-errors">
              …and {result.errors.length - result.sampleErrors.length} more
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── 5) Advanced accordion ──────────────────────────────────────────────────
function AdvancedDetails({
  analysis,
  result,
  expanded,
  onToggle,
  onChooseDifferentSheet,
}: {
  analysis: AutoExtractAnalysis | null;
  result: AutoExtractResult | null;
  expanded: boolean;
  onToggle: () => void;
  onChooseDifferentSheet?: () => void;
}) {
  if (!analysis) return null;

  const detectedColumns = analysis.detectedColumns || {};
  const skippedRows = analysis.dataRowDetection?.skippedRows ?? 0;
  const columnEntries = Object.entries(detectedColumns).filter(([k]) => k !== 'siteId');

  return (
    <section className="advanced-section">
      <button
        type="button"
        className="advanced-trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="advanced-trigger-text">Advanced</span>
        <span className="advanced-trigger-icon" aria-hidden>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="advanced-content">
          {onChooseDifferentSheet && (
            <div className="advanced-block">
              <h4>Sheet</h4>
              <p>
                <button type="button" className="btn btn-ghost btn-inline" onClick={onChooseDifferentSheet}>
                  Choose a different sheet
                </button>
              </p>
            </div>
          )}
          {skippedRows > 0 && (
            <div className="advanced-block">
              <h4>Data detection</h4>
              <p>Skipped {skippedRows} header/descriptor row{skippedRows !== 1 ? 's' : ''} at the start of the sheet.</p>
            </div>
          )}
          <div className="advanced-block">
            <h4>Detected columns</h4>
            <div className="advanced-columns-grid">
              {columnEntries.map(([field, column]) => (
                <div key={field} className="advanced-column-item">
                  <span className="advanced-column-field">{field}</span>
                  <span className="advanced-column-source">{column ? `← ${column}` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
          {result?.detectedColumns && (
            <div className="advanced-block">
              <h4>Preview details</h4>
              <p>Created: {result.created}, Updated: {result.updated}, Skipped: {result.skipped}, Unchanged: {result.unchanged}.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export const AutoExtract: React.FC<AutoExtractProps> = ({
  importId,
  sheetId,
  sheetName,
  rowCount,
  onComplete,
  onBack,
  onChooseDifferentSheet,
}) => {
  const [analysis, setAnalysis] = useState<AutoExtractAnalysis | null>(null);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [assetType, setAssetType] = useState<string>('');
  const [lifeYears, setLifeYears] = useState<number>(20);
  const [replacementCostEur, setReplacementCostEur] = useState<number | undefined>(undefined);
  const [criticality, setCriticality] = useState<Criticality>('medium');
  const [allowFallbackIdentity, setAllowFallbackIdentity] = useState(true);

  const [locationMode, setLocationMode] = useState<LocationMode>('one-location');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [creatingLocation, setCreatingLocation] = useState(false);

  const dataRowCount = analysis?.dataRowCount ?? rowCount ?? 0;

  const loadData = useCallback(async (siteOverrideId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [analysisResult, types, siteList] = await Promise.all([
        analyzeForAutoExtract(importId, sheetId, siteOverrideId),
        listAssetTypes(),
        listSites(),
      ]);
      setAnalysis(analysisResult);
      setAssetTypes(types);
      setSites(siteList);

      if (analysisResult.suggestedAssetType) {
        setAssetType((prev) => prev || analysisResult.suggestedAssetType!);
      } else if (types.length > 0) {
        setAssetType((prev) => prev || types[0].code);
      }

      if (siteList.length === 0) {
        setLocationMode('one-location');
        setShowCreateLocation(true);
      } else if (analysisResult.needsSiteSelection || analysisResult.detectedSites.length === 0) {
        setLocationMode('one-location');
        if (siteList.length === 1) setSelectedLocationId(siteList[0].id);
      } else if (analysisResult.unknownSites.length > 0) {
        setLocationMode('from-file');
      } else {
        setLocationMode('from-file');
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

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      setError('Please enter a location name');
      return;
    }
    try {
      setCreatingLocation(true);
      setError(null);
      const newSite = await createSite({ name: newLocationName.trim() });
      setSites((prev) => [...prev, newSite]);
      setSelectedLocationId(newSite.id);
      setShowCreateLocation(false);
      setNewLocationName('');
      setLocationMode('one-location');
      const newAnalysis = await analyzeForAutoExtract(importId, sheetId, newSite.id);
      setAnalysis(newAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location');
    } finally {
      setCreatingLocation(false);
    }
  };

  const locationChosen =
    sites.length > 0 &&
    (locationMode === 'from-file'
      ? (analysis?.detectedSites?.length ?? 0) > 0 && (analysis?.unknownSites?.length ?? 0) === 0
      : !!selectedLocationId);

  const canProceed = !!assetType && locationChosen;

  function getSiteOverrideId(): string | undefined {
    if (locationMode === 'one-location' && selectedLocationId) return selectedLocationId;
    if (locationMode === 'from-file' && (analysis?.detectedSites?.length === 1) && (analysis?.unknownSites?.length === 0)) {
      const name = analysis.detectedSites[0];
      const site = sites.find((s) => s.name.toLowerCase() === name.toLowerCase());
      return site?.id;
    }
    return undefined;
  }

  const handlePreview = async () => {
    if (!canProceed) {
      if (!locationChosen) setError('Choose a location to continue');
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
      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: true,
        allowFallbackIdentity,
        siteOverrideId: getSiteOverrideId(),
      });
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = async () => {
    if (!canProceed) return;
    try {
      setExecuting(true);
      setError(null);
      const defaults: SheetDefaults = {
        assetType,
        lifeYears,
        replacementCostEur,
        criticality,
      };
      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: false,
        allowFallbackIdentity,
        siteOverrideId: getSiteOverrideId(),
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
      <div className="auto-extract auto-extract-page">
        <div className="loading-spinner">Analyzing sheet…</div>
      </div>
    );
  }

  if (analysis && !analysis.canAutoExtract) {
    return (
      <div className="auto-extract auto-extract-page">
        <ImportSummary
          sheetName={sheetName}
          dataRowCount={dataRowCount}
          suggestedAssetType={analysis.suggestedAssetType}
        />
        <div className="warning-banner">
          <strong>This sheet can't be quick-imported.</strong> {analysis.issues.join(' ')}
          <p>Use the full mapping editor instead.</p>
        </div>
        <div className="auto-extract-footer">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="auto-extract auto-extract-page">
        <ImportSummary
          sheetName={sheetName}
          dataRowCount={dataRowCount}
          suggestedAssetType={analysis?.suggestedAssetType ?? null}
        />
        <section className="location-section">
          <h3 className="section-title">Location for these assets</h3>
          <p className="location-help">Create your first location to continue.</p>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button type="button" className="btn btn-small" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}
          <div className="create-first-location">
            <div className="form-group">
              <label htmlFor="newLocationName">Location name</label>
              <input
                id="newLocationName"
                type="text"
                placeholder="e.g. Water Treatment Facility, Pump Station 1"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateLocation}
              disabled={!newLocationName.trim() || creatingLocation}
            >
              {creatingLocation ? 'Creating…' : 'Create location & continue'}
            </button>
          </div>
        </section>
        <div className="auto-extract-footer">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const primaryButtonLabel = !locationChosen
    ? 'Choose a location to continue'
    : !previewResult
      ? 'Preview import'
      : 'Import assets';

  return (
    <div className="auto-extract auto-extract-page">
      <ImportSummary
        sheetName={sheetName}
        dataRowCount={dataRowCount}
        suggestedAssetType={analysis?.suggestedAssetType ?? null}
      />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" className="btn btn-small" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <LocationPicker
        analysis={analysis}
        sites={sites}
        locationMode={locationMode}
        setLocationMode={setLocationMode}
        selectedLocationId={selectedLocationId}
        setSelectedLocationId={setSelectedLocationId}
        showCreateLocation={showCreateLocation}
        setShowCreateLocation={setShowCreateLocation}
        newLocationName={newLocationName}
        setNewLocationName={setNewLocationName}
        creatingLocation={creatingLocation}
        onCreateLocation={handleCreateLocation}
        error={error}
        setError={setError}
      />

      <Assumptions
        assetTypes={assetTypes}
        suggestedAssetType={analysis?.suggestedAssetType ?? null}
        assetType={assetType}
        setAssetType={setAssetType}
        lifeYears={lifeYears}
        setLifeYears={setLifeYears}
        replacementCostEur={replacementCostEur}
        setReplacementCostEur={setReplacementCostEur}
        criticality={criticality}
        setCriticality={setCriticality}
        allowFallbackIdentity={allowFallbackIdentity}
        setAllowFallbackIdentity={setAllowFallbackIdentity}
        dataRowCount={dataRowCount}
      />

      {previewResult && (
        <PreviewOutcome
          result={previewResult}
          locationChosen={locationChosen}
          allowFallbackIdentity={allowFallbackIdentity}
        />
      )}

      <AdvancedDetails
        analysis={analysis}
        result={previewResult}
        expanded={advancedOpen}
        onToggle={() => setAdvancedOpen((o) => !o)}
        onChooseDifferentSheet={onChooseDifferentSheet}
      />

      <footer className="auto-extract-footer">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <div className="primary-actions">
          {previewResult ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewResult(null)}
              >
                Edit details
              </button>
              <button
                type="button"
                className="btn btn-primary btn-import"
                onClick={handleExecute}
                disabled={executing || (previewResult.errors?.length ?? 0) > 0}
              >
                {executing ? 'Importing…' : 'Import assets'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-preview"
              onClick={handlePreview}
              disabled={executing || !locationChosen}
            >
              {executing ? 'Loading…' : primaryButtonLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
