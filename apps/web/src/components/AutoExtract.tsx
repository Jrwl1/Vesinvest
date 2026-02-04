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
  SheetPlan,
  AssetType,
  Site,
  Criticality,
} from '../types';
import { humanizeFieldName } from '../utils/format';

/** Map plan location mode to internal. */
function toLocationMode(m: SheetPlan['locationMode']): LocationMode {
  return m === 'fromFile' ? 'from-file' : 'one-location';
}

function toPlanLocationMode(m: LocationMode): SheetPlan['locationMode'] {
  return m === 'from-file' ? 'fromFile' : 'oneLocation';
}

interface AutoExtractProps {
  importId: string;
  sheetId: string;
  sheetName: string;
  rowCount: number;
  onComplete: (result: AutoExtractResult) => void;
  onBack: () => void;
  /** When provided, show "Choose a different sheet" in Advanced */
  onChooseDifferentSheet?: () => void;
  /** When provided, "Preview import" calls this instead of showing preview inline (parent shows Preview step) */
  onPreview?: (
    result: AutoExtractResult,
    options: { sheetDefaults: SheetDefaults; siteOverrideId?: string }
  ) => void;
  /** Embedded in Import Plan: parent controls sheet list; sync plan state back */
  embedded?: boolean;
  /** Initial plan from parent (embedded mode). */
  initialPlan?: Partial<SheetPlan>;
  /** Called when location/defaults change (embedded mode). */
  onPlanChange?: (plan: Partial<SheetPlan>) => void;
  /** Bulk default asset type (embedded, multi-sheet). Enables override in Advanced. */
  embeddedBulkAssetTypeCode?: string | null;
  /** Current per-sheet override value when user has overridden (embedded). */
  assetTypeOverride?: string;
  /** Called when user sets override asset type for this sheet (embedded). */
  onAssetTypeOverride?: (code: string) => void;
  /** Called when user clears override (embedded). */
  onClearAssetTypeOverride?: () => void;
  /** When true, location is set globally; hide per-sheet location picker (embedded). */
  useGlobalLocation?: boolean;
  /** Global location id when useGlobalLocation is true (embedded). */
  globalSiteOverrideId?: string | null;
  /** When sheet has unknown locations, call this to turn on global location and focus bulk picker (embedded). */
  onUseOneLocationForAll?: () => void;
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

/** Rewrite technical backend messages for calm, user-facing copy. No schema/internal words in UI. */
function humanizeInfoMessage(msg: string): string {
  if (msg.includes('Numeric identifiers') && msg.includes('normalized')) {
    return 'Numeric IDs detected — we handled them automatically.';
  }
  if (msg.includes('Numeric IDs') && msg.includes('converted')) {
    return 'Numeric IDs detected — we handled them automatically.';
  }
  if (msg.includes('fallback') || msg.includes('derived') || msg.includes('generated') || msg.includes('externalRef')) {
    return 'Some rows are missing IDs — we can generate them if you enable it above.';
  }
  if (msg.includes('Skipped') && msg.includes('header')) {
    return msg;
  }
  if (msg.includes('normalized') || msg.includes('identity')) {
    return 'IDs in your file were adjusted to a standard format.';
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
  useGlobalLocation,
  onUseOneLocationForAll,
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
  useGlobalLocation?: boolean;
  onUseOneLocationForAll?: () => void;
}) {
  const hasDetectedLocations = (analysis?.detectedSites?.length ?? 0) > 0;
  const hasUnknownLocations = (analysis?.unknownSites?.length ?? 0) > 0;
  const needsChoice = analysis?.needsSiteSelection || !hasDetectedLocations;

  if (useGlobalLocation) {
    return (
      <section className="location-section" aria-labelledby="location-heading">
        <h3 id="location-heading" className="section-title">Location</h3>
        <p className="location-help">Using the same location for all selected sheets. Change it in the bulk defaults above.</p>
      </section>
    );
  }

  return (
    <section className="location-section" aria-labelledby="location-heading">
      <h3 id="location-heading" className="section-title">
        Location
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
            onClick={onUseOneLocationForAll ?? (() => setLocationMode('one-location'))}
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
  const suggestedLabel = suggestedAssetType
    ? (assetTypes.find((at) => at.code === suggestedAssetType)?.name ?? suggestedAssetType)
    : null;

  return (
    <section className="assumptions-section" aria-labelledby="assumptions-heading">
      <h3 id="assumptions-heading" className="section-title">
        Missing details we'll fill in
      </h3>
      <p className="section-hint">
        These apply only where the file doesn't include a value.
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
                {at.name}
              </option>
            ))}
          </select>
          {suggestedLabel && (
            <span className="form-hint suggested">Suggested: {suggestedLabel}</span>
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
          <span className="form-hint">Used only if the file doesn't include this.</span>
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
          {allowFallbackIdentity
            ? `${derivedCount} row${derivedCount !== 1 ? 's' : ''} ${derivedCount === 1 ? 'is' : 'are'} missing an ID and will get one automatically.`
            : `${derivedCount} asset${derivedCount !== 1 ? 's' : ''} ${derivedCount === 1 ? 'is' : 'are'} missing an ID and will be skipped unless ID generation is enabled.`}
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
  assetTypes,
  embeddedBulkAssetTypeCode,
  assetTypeOverride,
  onAssetTypeOverride,
  onClearAssetTypeOverride,
}: {
  analysis: AutoExtractAnalysis | null;
  result: AutoExtractResult | null;
  expanded: boolean;
  onToggle: () => void;
  onChooseDifferentSheet?: () => void;
  assetTypes?: AssetType[];
  embeddedBulkAssetTypeCode?: string | null;
  assetTypeOverride?: string;
  onAssetTypeOverride?: (code: string) => void;
  onClearAssetTypeOverride?: () => void;
}) {
  if (!analysis) return null;

  const detectedColumns = analysis.detectedColumns || {};
  const skippedRows = analysis.dataRowDetection?.skippedRows ?? 0;
  const columnEntries = Object.entries(detectedColumns).filter(([k]) => k !== 'siteId');
  const showOverrideAssetType = embeddedBulkAssetTypeCode != null && assetTypes && assetTypes.length > 0 && (onAssetTypeOverride != null || onClearAssetTypeOverride != null);

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
          {showOverrideAssetType && (
            <div className="advanced-block">
              <h4>Override asset type for this sheet</h4>
              <p className="advanced-override-hint">Use a different asset type than the bulk default for this sheet only.</p>
              <div className="advanced-override-row">
                <select
                  aria-label="Override asset type for this sheet"
                  value={assetTypeOverride ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) onAssetTypeOverride?.(v); else onClearAssetTypeOverride?.();
                  }}
                  className="advanced-override-select"
                >
                  <option value="">Use bulk default</option>
                  {assetTypes!.map((at) => (
                    <option key={at.id} value={at.code}>{at.name}</option>
                  ))}
                </select>
                {(assetTypeOverride != null && assetTypeOverride !== '') && (
                  <button type="button" className="btn btn-small btn-ghost" onClick={onClearAssetTypeOverride}>
                    Clear override
                  </button>
                )}
              </div>
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
                  <span className="advanced-column-field">{humanizeFieldName(field)}</span>
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
  onPreview,
  embedded,
  initialPlan,
  onPlanChange,
  embeddedBulkAssetTypeCode,
  assetTypeOverride,
  onAssetTypeOverride,
  onClearAssetTypeOverride,
  useGlobalLocation,
  globalSiteOverrideId,
  onUseOneLocationForAll,
}) => {
  const [analysis, setAnalysis] = useState<AutoExtractAnalysis | null>(null);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [assetType, setAssetType] = useState<string>(initialPlan?.assetTypeCode ?? '');
  const [lifeYears, setLifeYears] = useState<number>(initialPlan?.lifeYears ?? 20);
  const [replacementCostEur, setReplacementCostEur] = useState<number | undefined>(initialPlan?.replacementCostEur);
  const [criticality, setCriticality] = useState<Criticality>(initialPlan?.criticality ?? 'medium');
  const [allowFallbackIdentity, setAllowFallbackIdentity] = useState(initialPlan?.allowFallbackIdentity ?? true);

  const [locationMode, setLocationMode] = useState<LocationMode>(
    initialPlan?.locationMode ? toLocationMode(initialPlan.locationMode) : 'one-location'
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(initialPlan?.siteOverrideId ?? '');
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
    (useGlobalLocation && !!globalSiteOverrideId) ||
    (sites.length > 0 &&
      (locationMode === 'from-file'
        ? (analysis?.detectedSites?.length ?? 0) > 0 && (analysis?.unknownSites?.length ?? 0) === 0
        : !!selectedLocationId));

  const locationResolved = locationChosen;

  const canProceed = !!assetType && locationChosen;

  function getSiteOverrideId(): string | undefined {
    if (useGlobalLocation && globalSiteOverrideId) return globalSiteOverrideId;
    if (locationMode === 'one-location' && selectedLocationId) return selectedLocationId;
    if (locationMode === 'from-file' && (analysis?.detectedSites?.length === 1) && (analysis?.unknownSites?.length === 0)) {
      const name = analysis.detectedSites[0];
      const site = sites.find((s) => s.name.toLowerCase() === name.toLowerCase());
      return site?.id;
    }
    return undefined;
  }

  /** Sync plan state to parent (embedded Import Plan). */
  useEffect(() => {
    if (!onPlanChange || !analysis) return;
    onPlanChange({
      locationMode: toPlanLocationMode(locationMode),
      siteOverrideId: getSiteOverrideId(),
      assetTypeCode: assetType,
      lifeYears,
      replacementCostEur,
      criticality,
      allowFallbackIdentity,
      locationResolved,
    });
  }, [
    onPlanChange,
    analysis,
    locationMode,
    selectedLocationId,
    assetType,
    lifeYears,
    replacementCostEur,
    criticality,
    allowFallbackIdentity,
    locationResolved,
  ]);

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
      const siteOverrideId = getSiteOverrideId();
      const result = await autoExtract(importId, sheetId, defaults, {
        dryRun: true,
        allowFallbackIdentity,
        siteOverrideId,
      });
      if (onPreview) {
        onPreview(result, { sheetDefaults: defaults, siteOverrideId });
      } else {
        setPreviewResult(result);
      }
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
          <p>Use the column mapping flow instead.</p>
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
          <h3 className="section-title">Location</h3>
          <p className="location-help">Create your first location</p>
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

  const showPreviewInline = !onPreview && !!previewResult;
  const primaryCtaLabel = !locationChosen
    ? 'Choose a location to continue'
    : 'Preview import';

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
        useGlobalLocation={useGlobalLocation}
        onUseOneLocationForAll={onUseOneLocationForAll}
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

      {showPreviewInline && previewResult && (
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
        onChooseDifferentSheet={embedded ? undefined : onChooseDifferentSheet}
        assetTypes={embedded && embeddedBulkAssetTypeCode != null ? assetTypes : undefined}
        embeddedBulkAssetTypeCode={embeddedBulkAssetTypeCode}
        assetTypeOverride={assetTypeOverride}
        onAssetTypeOverride={onAssetTypeOverride}
        onClearAssetTypeOverride={onClearAssetTypeOverride}
      />

      <footer className="auto-extract-footer">
        {!embedded && (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
        )}
        <div className="primary-actions">
          {!onPreview && previewResult ? (
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
              {executing ? 'Loading…' : primaryCtaLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
