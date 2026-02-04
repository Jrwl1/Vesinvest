import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  listImports,
  uploadExcel,
  deleteImport,
  getSheetPreview,
  getImportInbox,
  findMatchingTemplates,
  listTemplates,
  autoExtract,
} from '../api';
import type {
  ExcelImport,
  ExcelSheet,
  TargetEntity,
  ImportMapping,
  TemplateMatchResult,
  ImportExecutionResult,
  AutoExtractResult,
  ColumnProfile,
  ImportInbox,
  ImportInboxGroup,
  SheetDefaults,
  SheetPlan,
  SheetPlanStatus,
} from '../types';
import { humanizeFieldName } from '../utils/format';
import { MappingEditor } from '../components/MappingEditor';
import { ReadinessGate } from '../components/ReadinessGate';
import { AutoExtract } from '../components/AutoExtract';
import { SanitySummaryModal } from '../components/SanitySummaryModal';
import { useNavigation } from '../context/NavigationContext';

type ImportStep =
  | 'import-plan'    // Workbook Import Plan: two-pane, multi-sheet
  | 'inbox'          // After upload: list of groups (sheets) with signals (legacy single-sheet entry)
  | 'sort'           // Quick Sort (location + assumptions)
  | 'preview'        // Will create/update/skip, then Import assets
  | 'choose-sheet'   // Fallback sheet list
  | 'auto-extract'   // Quick Import (legacy path, same as sort)
  | 'choose-method'
  | 'template'
  | 'mapping'
  | 'readiness'
  | 'complete';

/** Pipe-related sheet name heuristic for title. */
function isPipeRelated(sheetName: string): boolean {
  const lower = sheetName.toLowerCase();
  return /ledning|ledningar|vatten|avlopp|pipe|pipes/.test(lower);
}

function getGroupTitle(sheetName: string): string {
  return isPipeRelated(sheetName)
    ? `Import pipes from ${sheetName}`
    : `Import assets from ${sheetName}`;
}

/** Minimal plan when no group (e.g. include toggle before init). */
function minimalSheetPlan(): SheetPlan {
  return {
    included: false,
    locationMode: 'oneLocation',
    assetTypeCode: '',
    lifeYears: 20,
    criticality: 'medium',
    allowFallbackIdentity: true,
    hasPreview: false,
    locationResolved: false,
  };
}

/** Default plan for a sheet. included = true only when supported and has rows. */
function defaultSheetPlan(group: ImportInboxGroup): SheetPlan {
  const supported = group.recommendedMethod === 'quick';
  const included = supported && (group.dataRowCount ?? 0) > 0;
  return {
    ...minimalSheetPlan(),
    included,
  };
}

function getSheetPlanStatus(
  group: ImportInboxGroup,
  plan: SheetPlan
): SheetPlanStatus {
  const supported = group.recommendedMethod === 'quick';
  if (!supported) return 'not-supported';
  if (!plan.included) return 'not-supported';
  if (!plan.assetTypeCode) return 'needs-asset-type';
  if (!plan.locationResolved) return 'needs-location';
  return 'ready';
}

/** Sort order: Ready first, then needs attention, then not supported. */
function sortGroupsByStatus(
  groups: ImportInboxGroup[],
  sheetPlans: Record<string, SheetPlan>
): ImportInboxGroup[] {
  const order: Record<SheetPlanStatus, number> = {
    ready: 0,
    'needs-location': 1,
    'needs-asset-type': 2,
    'not-supported': 3,
  };
  return [...groups].sort((a, b) => {
    const statusA = getSheetPlanStatus(a, sheetPlans[a.sheetId] ?? defaultSheetPlan(a));
    const statusB = getSheetPlanStatus(b, sheetPlans[b.sheetId] ?? defaultSheetPlan(b));
    return order[statusA] - order[statusB];
  });
}

interface SheetPreview {
  id: string;
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
  columnsProfile?: ColumnProfile[];
}

export const ImportPage: React.FC = () => {
  const [imports, setImports] = useState<ExcelImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImport, setSelectedImport] = useState<ExcelImport | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ExcelSheet | null>(null);
  const [sheetPreview, setSheetPreview] = useState<SheetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [targetEntity, setTargetEntity] = useState<TargetEntity>('asset');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('choose-sheet');
  const [autoAnalysisFailed, setAutoAnalysisFailed] = useState(false);
  const [inboxData, setInboxData] = useState<ImportInbox | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoExtractResult | null>(null);
  const [pendingExecuteOptions, setPendingExecuteOptions] = useState<{
    sheetDefaults: SheetDefaults;
    siteOverrideId?: string;
  } | null>(null);
  const [templates, setTemplates] = useState<ImportMapping[]>([]);
  const [templateMatches, setTemplateMatches] = useState<TemplateMatchResult[]>([]);
  const [bestMatch, setBestMatch] = useState<TemplateMatchResult | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<ImportMapping | null>(null);
  const [lastResult, setLastResult] = useState<ImportExecutionResult | null>(null);
  const [autoExtractResult, setAutoExtractResult] = useState<AutoExtractResult | null>(null);

  const [sanitySummaryImportId, setSanitySummaryImportId] = useState<string | null>(null);
  const { navigateToTab } = useNavigation();

  // Workbook Import Plan (multi-sheet)
  const [sheetPlans, setSheetPlans] = useState<Record<string, SheetPlan>>({});
  const [selectedSheetIdForPlan, setSelectedSheetIdForPlan] = useState<string | null>(null);
  const [batchPreviewRunning, setBatchPreviewRunning] = useState(false);
  const [batchImportRunning, setBatchImportRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; phase: 'preview' | 'import' } | null>(null);
  const [batchError, setBatchError] = useState<{ sheetId: string; sheetName: string; message: string } | null>(null);
  const [planImportDone, setPlanImportDone] = useState(false);
  const [planImportResults, setPlanImportResults] = useState<Array<{ sheetId: string; sheetName: string; result: AutoExtractResult }>>([]);

  const fetchImports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listImports();
      setImports(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load imports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  // Restore from URL when page loads with importId & sheetId (e.g. after refresh)
  useEffect(() => {
    if (loading || imports.length === 0 || selectedImport) return;
    const params = new URLSearchParams(window.location.search);
    const importIdFromUrl = params.get('importId');
    const sheetIdFromUrl = params.get('sheetId');
    if (!importIdFromUrl || !sheetIdFromUrl) return;
    const imp = imports.find((i) => i.id === importIdFromUrl);
    if (!imp) return;
    const sheet = imp.sheets.find((s) => s.id === sheetIdFromUrl);
    if (!sheet) return;
    setSelectedImport(imp);
    setSelectedSheet(sheet);
    setStep('sort');
  }, [loading, imports, selectedImport]);

  // Load inbox when we have an import and are on inbox or import-plan step
  useEffect(() => {
    if ((step !== 'inbox' && step !== 'import-plan') || !selectedImport) return;
    let cancelled = false;
    setInboxLoading(true);
    getImportInbox(selectedImport.id)
      .then((data) => {
        if (!cancelled) {
          setInboxData(data);
          if (step === 'import-plan' && data.groups.length > 0) {
            setSheetPlans((prev) => {
              const next = { ...prev };
              for (const group of data.groups) {
                if (next[group.sheetId] === undefined) {
                  next[group.sheetId] = defaultSheetPlan(group);
                }
              }
              return next;
            });
            setSelectedSheetIdForPlan((current) =>
              current && data.groups.some((g) => g.sheetId === current) ? current : data.groups[0]?.sheetId ?? null
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setInboxData(null);
      })
      .finally(() => {
        if (!cancelled) setInboxLoading(false);
      });
    return () => { cancelled = true; };
  }, [step, selectedImport?.id]);

  /** Update URL to reflect Quick Import state (for bookmarking / refresh). */
  const updateQuickImportUrl = useCallback((importId: string, sheetId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('importId', importId);
    params.set('sheetId', sheetId);
    const url = `${window.location.pathname}${window.location.hash}?${params.toString()}`;
    window.history.replaceState(null, '', url);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const response = await uploadExcel(file);
      setImports((prev) => [response.import, ...prev]);
      setSelectedImport(response.import);
      setSelectedSheet(null);
      setInboxData(null);
      setSheetPlans({});
      setSelectedSheetIdForPlan(null);
      setBatchError(null);
      setPlanImportDone(false);
      setPlanImportResults([]);
      setStep(response.import.sheets.length > 0 ? 'import-plan' : 'choose-sheet');
      setAutoAnalysisFailed(response.import.sheets.length === 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this import?')) return;

    try {
      await deleteImport(id);
      setImports((prev) => prev.filter((i) => i.id !== id));
      if (selectedImport?.id === id) {
        setSelectedImport(null);
        setSelectedSheet(null);
        setSheetPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSelectImport = useCallback((imp: ExcelImport) => {
    setSelectedImport(imp);
    setSheetPreview(null);
    setSelectedSheet(null);
    setInboxData(null);
    setAutoAnalysisFailed(false);
    setStep(imp.sheets.length > 0 ? 'import-plan' : 'choose-sheet');
    setAutoAnalysisFailed(imp.sheets.length === 0);
  }, []);

  const handleSelectSheet = async (sheet: ExcelSheet) => {
    setSelectedSheet(sheet);
    if (selectedImport) {
      try {
        setPreviewLoading(true);
        const preview = await getSheetPreview(selectedImport.id, sheet.id);
        setSheetPreview(preview);
      } catch (err) {
        console.error('Failed to load preview:', err);
        // Fallback to using sheet's sampleRows
        setSheetPreview({
          id: sheet.id,
          sheetName: sheet.sheetName,
          headers: sheet.headers,
          rowCount: sheet.rowCount,
          sampleRows: sheet.sampleRows || [],
        });
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleStartImport = async () => {
    if (!selectedImport || !selectedSheet) return;
    // Show method selection (Auto-Extract vs Full Mapping)
    setStep('choose-method');
  };

  const handleChooseFullMapping = async () => {
    if (!selectedImport || !selectedSheet) return;

    try {
      setPreviewLoading(true);
      // Fetch template matches
      const matchResult = await findMatchingTemplates(
        selectedImport.id,
        selectedSheet.id,
        targetEntity
      );
      setTemplateMatches(matchResult.matches);
      setBestMatch(matchResult.bestMatch);

      // Also fetch all templates for manual selection
      const allTemplates = await listTemplates(targetEntity);
      setTemplates(allTemplates);

      // If we have a high-confidence match, show template selection
      // Otherwise, go directly to mapping editor
      if (matchResult.matches.length > 0) {
        setStep('template');
      } else {
        setStep('mapping');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find templates');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleChooseAutoExtract = () => {
    setStep('auto-extract');
  };

  /** Import Plan: toggle sheet included. */
  const handlePlanIncludeToggle = useCallback((sheetId: string, included: boolean) => {
    setSheetPlans((prev) => ({
      ...prev,
      [sheetId]: { ...(prev[sheetId] ?? minimalSheetPlan()), included },
    }));
  }, []);

  /** Import Plan: sync plan from AutoExtract (embedded). */
  const handlePlanChange = useCallback((sheetId: string) => (plan: Partial<SheetPlan>) => {
    setSheetPlans((prev) => {
      const current = prev[sheetId];
      if (!current) return prev;
      return { ...prev, [sheetId]: { ...current, ...plan } };
    });
  }, []);

  /** Import Plan: Preview all selected sheets. */
  const handlePreviewAll = useCallback(async () => {
    if (!selectedImport || !inboxData) return;
    setBatchError(null);
    setBatchPreviewRunning(true);
    const groups = inboxData.groups.filter((g) => {
      const plan = sheetPlans[g.sheetId] ?? defaultSheetPlan(g);
      return plan.included && g.recommendedMethod === 'quick';
    });
    setBatchProgress({ current: 0, total: groups.length, phase: 'preview' });
    const results: Record<string, SheetPlan> = { ...sheetPlans };
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const plan = results[group.sheetId] ?? defaultSheetPlan(group);
      setBatchProgress({ current: i + 1, total: groups.length, phase: 'preview' });
      try {
        const result = await autoExtract(
          selectedImport.id,
          group.sheetId,
          {
            assetType: plan.assetTypeCode,
            lifeYears: plan.lifeYears,
            replacementCostEur: plan.replacementCostEur,
            criticality: plan.criticality,
          },
          { dryRun: true, allowFallbackIdentity: plan.allowFallbackIdentity, siteOverrideId: plan.siteOverrideId }
        );
        results[group.sheetId] = { ...plan, hasPreview: true, previewResult: result };
        setSheetPlans((prev) => ({ ...prev, [group.sheetId]: results[group.sheetId]! }));
      } catch (err) {
        setBatchError({
          sheetId: group.sheetId,
          sheetName: group.sheetName,
          message: err instanceof Error ? err.message : 'Preview failed',
        });
        setBatchPreviewRunning(false);
        setBatchProgress(null);
        return;
      }
    }
    setBatchPreviewRunning(false);
    setBatchProgress(null);
  }, [selectedImport, inboxData, sheetPlans]);

  /** Import Plan: Import all selected sheets. */
  const handleImportAll = useCallback(async () => {
    if (!selectedImport || !inboxData) return;
    setBatchError(null);
    setBatchImportRunning(true);
    const groups = inboxData.groups.filter((g) => {
      const plan = sheetPlans[g.sheetId] ?? defaultSheetPlan(g);
      return plan.included && g.recommendedMethod === 'quick' && plan.hasPreview;
    });
    setBatchProgress({ current: 0, total: groups.length, phase: 'import' });
    const importResults: Array<{ sheetId: string; sheetName: string; result: AutoExtractResult }> = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const plan = sheetPlans[group.sheetId] ?? defaultSheetPlan(group);
      setBatchProgress({ current: i + 1, total: groups.length, phase: 'import' });
      try {
        const result = await autoExtract(
          selectedImport.id,
          group.sheetId,
          {
            assetType: plan.assetTypeCode,
            lifeYears: plan.lifeYears,
            replacementCostEur: plan.replacementCostEur,
            criticality: plan.criticality,
          },
          { dryRun: false, allowFallbackIdentity: plan.allowFallbackIdentity, siteOverrideId: plan.siteOverrideId }
        );
        importResults.push({ sheetId: group.sheetId, sheetName: group.sheetName, result });
      } catch (err) {
        setBatchError({
          sheetId: group.sheetId,
          sheetName: group.sheetName,
          message: err instanceof Error ? err.message : 'Import failed',
        });
        setBatchImportRunning(false);
        setBatchProgress(null);
        return;
      }
    }
    setPlanImportResults(importResults);
    setPlanImportDone(true);
    setBatchImportRunning(false);
    setBatchProgress(null);
    fetchImports();
    const totalCreated = importResults.reduce((s, r) => s + r.result.created, 0);
    if (totalCreated > 0) setSanitySummaryImportId(selectedImport.id);
  }, [selectedImport, inboxData, sheetPlans, fetchImports]);

  /** From Inbox: user clicked "Sort & import" on a group. */
  const handleSortAndImport = useCallback(
    (group: ImportInboxGroup) => {
      if (!selectedImport) return;
      const sheet = selectedImport.sheets.find((s) => s.id === group.sheetId);
      if (!sheet) return;
      setSelectedSheet(sheet);
      updateQuickImportUrl(selectedImport.id, sheet.id);
      setStep(group.recommendedMethod === 'quick' ? 'sort' : 'choose-method');
    },
    [selectedImport, updateQuickImportUrl]
  );

  /** From choose-sheet fallback: user picked a sheet for Quick Import. */
  const handlePickSheetForQuickImport = useCallback(
    (sheet: ExcelSheet) => {
      if (!selectedImport) return;
      setSelectedSheet(sheet);
      setStep('sort');
      updateQuickImportUrl(selectedImport.id, sheet.id);
    },
    [selectedImport, updateQuickImportUrl]
  );

  /** From AutoExtract (Sort): user chose "Choose a different sheet" in Advanced. */
  const handleChooseDifferentSheet = useCallback(() => {
    setStep('inbox');
    setSelectedSheet(null);
    setPreviewResult(null);
    setPendingExecuteOptions(null);
  }, []);

  /** From Sort: preview ready, go to Preview step. */
  const handlePreviewReady = useCallback(
    (result: AutoExtractResult, options: { sheetDefaults: SheetDefaults; siteOverrideId?: string }) => {
      setPreviewResult(result);
      setPendingExecuteOptions(options);
      setStep('preview');
    },
    []
  );

  /** From Preview step: run import. */
  const handleImportFromPreview = useCallback(async () => {
    if (!selectedImport || !selectedSheet || !pendingExecuteOptions) return;
    try {
      setError(null);
      const result = await autoExtract(
        selectedImport.id,
        selectedSheet.id,
        pendingExecuteOptions.sheetDefaults,
        {
          dryRun: false,
          siteOverrideId: pendingExecuteOptions.siteOverrideId,
        }
      );
      setAutoExtractResult(result);
      setStep('complete');
      setPreviewResult(null);
      setPendingExecuteOptions(null);
      fetchImports();
      if (result.success && result.created > 0) {
        setSanitySummaryImportId(selectedImport.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [selectedImport, selectedSheet, pendingExecuteOptions, fetchImports]);

  const handleAutoExtractComplete = (result: AutoExtractResult) => {
    setAutoExtractResult(result);
    setStep('complete');
    fetchImports();
    // Show sanity summary modal for successful imports with created assets
    if (result.success && result.created > 0 && selectedImport) {
      setSanitySummaryImportId(selectedImport.id);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedMapping(template);
      setStep('readiness');
    }
  };

  const handleCreateNewMapping = () => {
    setSelectedMapping(null);
    setStep('mapping');
  };

  const handleMappingSaved = async (mappingId: string) => {
    // Fetch the newly created mapping
    try {
      const allMappings = await listTemplates(targetEntity);
      const newMapping = allMappings.find((m) => m.id === mappingId);
      if (newMapping) {
        setSelectedMapping(newMapping);
        setStep('readiness');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mapping');
    }
  };

  const handleMappingCancelled = () => {
    if (templateMatches.length > 0) {
      setStep('template');
    } else {
      setStep('choose-sheet');
    }
  };

  const handleExecuteComplete = (result: ImportExecutionResult) => {
    setLastResult(result);
    setStep('complete');
    // Refresh imports list to show new status
    fetchImports();
    // Show sanity summary modal for successful imports with created assets
    if (result.success && result.created > 0 && selectedImport) {
      setSanitySummaryImportId(selectedImport.id);
    }
  };

  const handleBackToSelect = () => {
    setStep(selectedImport?.sheets?.length ? 'inbox' : 'choose-sheet');
    setSelectedSheet(null);
    setSelectedMapping(null);
    setTemplateMatches([]);
    setBestMatch(null);
    setLastResult(null);
    setAutoExtractResult(null);
  };

  /** From complete screen: clear selection so user can pick another import or upload. */
  const handleImportAnotherFile = () => {
    setSelectedImport(null);
    setSelectedSheet(null);
    setSheetPreview(null);
    setStep('choose-sheet');
    setAutoExtractResult(null);
    setLastResult(null);
  };

  // Load sheet preview only when not in Quick Import flow (for choose-sheet fallback if we add "Show sample data" later)
  useEffect(() => {
    if (selectedSheet && selectedImport && step !== 'auto-extract') {
      handleSelectSheet(selectedSheet);
    }
  }, [selectedSheet?.id, selectedImport?.id, step]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'status-badge status-pending';
      case 'mapped':
        return 'status-badge status-mapped';
      case 'imported':
        return 'status-badge status-success';
      case 'failed':
        return 'status-badge status-error';
      default:
        return 'status-badge';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading imports...</div>
      </div>
    );
  }

  return (
    <div className="page-container import-page">
      <div className="page-header">
        <h2>Excel Import</h2>
        <p className="page-description">
          Upload Excel files to import assets and data. The system will detect sheets and columns automatically.
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

      <div className="import-layout">
        {/* Left Panel - Import List */}
        <div className="import-list-panel">
          <div className="panel-header">
            <h3>Uploaded Files</h3>
            <div className="upload-controls">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="excel-upload"
              />
              <label
                htmlFor="excel-upload"
                className={`btn btn-primary ${uploading ? 'btn-disabled' : ''}`}
              >
                {uploading ? 'Uploading...' : 'Upload Excel'}
              </label>
            </div>
          </div>

          {imports.length === 0 ? (
            <div className="empty-state">
              <p>No files uploaded yet.</p>
              <p className="hint">Upload an Excel file to get started.</p>
            </div>
          ) : (
            <ul className="import-list">
              {imports.map((imp) => (
                <li
                  key={imp.id}
                  className={`import-item ${selectedImport?.id === imp.id ? 'selected' : ''}`}
                  onClick={() => handleSelectImport(imp)}
                >
                  <div className="import-item-header">
                    <span className="filename">{imp.filename}</span>
                    <span className={getStatusBadgeClass(imp.status)}>{imp.status}</span>
                  </div>
                  <div className="import-item-meta">
                    <span>{imp.sheets.length} sheet(s)</span>
                    <span>{formatDate(imp.uploadedAt)}</span>
                  </div>
                  <button
                    className="btn btn-small btn-danger import-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(imp.id);
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Panel: Import Plan | Inbox → Sort → Preview → Complete (or choose-sheet / legacy) */}
        <div className="sheet-preview-panel">
          {!selectedImport ? (
            <div className="empty-state">
              <p>Select an import or upload a file to get started.</p>
            </div>
          ) : step === 'import-plan' ? (
            /* Workbook Import Plan: two-pane + sticky footer */
            <div className="import-plan-view">
              <div className="import-plan-panes">
                <div className="import-plan-left">
                  <div className="panel-header">
                    <h3>Sheets</h3>
                  </div>
                  {inboxLoading ? (
                    <div className="empty-state">
                      <div className="loading-spinner">Loading…</div>
                    </div>
                  ) : inboxData ? (
                    <ul className="import-plan-sheet-list">
                      {sortGroupsByStatus(inboxData.groups, sheetPlans).map((group) => {
                        const plan = sheetPlans[group.sheetId] ?? defaultSheetPlan(group);
                        const status = getSheetPlanStatus(group, plan);
                        const supported = group.recommendedMethod === 'quick';
                        return (
                          <li
                            key={group.sheetId}
                            className={`import-plan-sheet-card ${selectedSheetIdForPlan === group.sheetId ? 'selected' : ''}`}
                          >
                            <div
                              className="import-plan-sheet-card-inner"
                              onClick={() => setSelectedSheetIdForPlan(group.sheetId)}
                            >
                              <div className="import-plan-sheet-name">{group.sheetName}</div>
                              <div className="import-plan-sheet-meta">
                                {group.dataRowCount} assets detected
                              </div>
                              <div className="import-plan-sheet-status">
                                {status === 'ready' && <span className="plan-pill ready">Ready</span>}
                                {status === 'needs-location' && <span className="plan-pill warn">Needs location</span>}
                                {status === 'needs-asset-type' && <span className="plan-pill warn">Needs asset type</span>}
                                {status === 'not-supported' && supported && !plan.included && <span className="plan-pill muted">Excluded</span>}
                                {status === 'not-supported' && !supported && <span className="plan-pill unsupported">Not supported</span>}
                              </div>
                              {supported && (
                                <label className="import-plan-include" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={plan.included}
                                    onChange={(e) => handlePlanIncludeToggle(group.sheetId, e.target.checked)}
                                  />
                                  <span>Include in import</span>
                                </label>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="empty-state">
                      <p>Could not load sheets.</p>
                    </div>
                  )}
                </div>
                <div className="import-plan-right">
                  {selectedSheetIdForPlan && selectedImport && inboxData && (() => {
                    const group = inboxData.groups.find((g) => g.sheetId === selectedSheetIdForPlan);
                    const sheet = selectedImport.sheets.find((s) => s.id === selectedSheetIdForPlan);
                    if (!group || !sheet) return null;
                    const plan = sheetPlans[selectedSheetIdForPlan] ?? defaultSheetPlan(group);
                    return (
                      <div className="import-plan-setup" key={selectedSheetIdForPlan}>
                        <AutoExtract
                          importId={selectedImport.id}
                          sheetId={sheet.id}
                          sheetName={sheet.sheetName}
                          rowCount={sheet.rowCount}
                          embedded
                          initialPlan={plan}
                          onPlanChange={handlePlanChange(selectedSheetIdForPlan)}
                          onComplete={(result) => {
                            setPlanImportResults((prev) => [...prev, { sheetId: sheet.id, sheetName: sheet.sheetName, result }]);
                            setSheetPlans((p) => ({
                              ...p,
                              [sheet.id]: { ...(p[sheet.id] ?? plan), hasPreview: true, previewResult: result },
                            }));
                          }}
                          onPreview={(result) => {
                            setSheetPlans((p) => ({
                              ...p,
                              [sheet.id]: { ...(p[sheet.id] ?? plan), hasPreview: true, previewResult: result },
                            }));
                          }}
                          onBack={() => {}}
                        />
                      </div>
                    );
                  })()}
                  {!selectedSheetIdForPlan && inboxData && inboxData.groups.length > 0 && (
                    <div className="empty-state">
                      <p>Select a sheet to set location and defaults.</p>
                    </div>
                  )}
                </div>
              </div>
              {planImportDone && planImportResults.length > 0 && (
                <div className="import-plan-done">
                  <h4>Import complete</h4>
                  <ul className="import-plan-done-list">
                    {planImportResults.map(({ sheetName, result }) => (
                      <li key={sheetName}>
                        {sheetName}: {result.created} created, {result.updated} updated, {(result.unchanged ?? 0) + (result.skipped ?? 0)} skipped
                      </li>
                    ))}
                  </ul>
                  <div className="import-plan-done-actions">
                    <button type="button" className="btn btn-primary" onClick={() => navigateToTab('assets')}>
                      Go to Your Infrastructure
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setPlanImportDone(false); setPlanImportResults([]); }}>
                      Import another file
                    </button>
                  </div>
                </div>
              )}
              {batchError && (
                <div className="error-banner import-plan-batch-error">
                  <span>{batchError.sheetName}: {batchError.message}</span>
                  <button type="button" className="btn btn-small" onClick={() => setBatchError(null)}>Dismiss</button>
                </div>
              )}
              <footer className="import-plan-footer">
                <div className="import-plan-footer-left">
                  Selected sheets: {inboxData?.groups.filter((g) => (sheetPlans[g.sheetId] ?? defaultSheetPlan(g)).included && g.recommendedMethod === 'quick').length ?? 0}
                </div>
                <div className="import-plan-footer-center">
                  {(() => {
                    const included = inboxData?.groups.filter((g) => {
                      const plan = sheetPlans[g.sheetId] ?? defaultSheetPlan(g);
                      return plan.included && g.recommendedMethod === 'quick' && plan.hasPreview;
                    }) ?? [];
                    const totalCreate = included.reduce((s, g) => s + ((sheetPlans[g.sheetId]?.previewResult?.created) ?? 0), 0);
                    const totalUpdate = included.reduce((s, g) => s + ((sheetPlans[g.sheetId]?.previewResult?.updated) ?? 0), 0);
                    const totalSkip = included.reduce((s, g) => {
                      const r = sheetPlans[g.sheetId]?.previewResult;
                      return s + (r ? (r.unchanged ?? 0) + (r.skipped ?? 0) : 0);
                    }, 0);
                    return (
                      <div className="import-plan-totals">
                        <span className="total create">Will create: {totalCreate}</span>
                        <span className="total update">Will update: {totalUpdate}</span>
                        <span className="total skip">Will skip: {totalSkip}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="import-plan-footer-right">
                  {batchProgress && (
                    <span className="import-plan-progress">
                      {batchProgress.phase === 'preview' ? 'Previewing' : 'Importing'} {batchProgress.current}/{batchProgress.total}…
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={batchPreviewRunning || batchImportRunning || (inboxData?.groups.filter((g) => ((sheetPlans[g.sheetId] ?? defaultSheetPlan(g)).included && g.recommendedMethod === 'quick')).length ?? 0) === 0}
                    onClick={handlePreviewAll}
                  >
                    Preview all
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      batchPreviewRunning ||
                      batchImportRunning ||
                      (inboxData?.groups.filter((g) => {
                        const plan = sheetPlans[g.sheetId] ?? defaultSheetPlan(g);
                        return plan.included && g.recommendedMethod === 'quick' && plan.hasPreview;
                      }).length ?? 0) === 0
                    }
                    onClick={handleImportAll}
                  >
                    Import all
                  </button>
                </div>
              </footer>
            </div>
          ) : step === 'inbox' ? (
            /* Inbox: list of groups (sheets) with signals */
            <div className="inbox-panel">
              <div className="panel-header">
                <h3>{selectedImport.filename}</h3>
              </div>
              {inboxLoading ? (
                <div className="empty-state">
                  <div className="loading-spinner">Loading…</div>
                </div>
              ) : inboxData ? (
                <div className="inbox-groups">
                  {inboxData.groups.map((group) => (
                    <div key={group.sheetId} className="inbox-group-card">
                      <h4 className="inbox-group-title">{getGroupTitle(group.sheetName)}</h4>
                      <p className="inbox-group-subtext">
                        {group.dataRowCount} assets detected
                      </p>
                      <div className="inbox-signals">
                        {group.signals.map((sig) => (
                          <span
                            key={sig.label}
                            className={`inbox-signal inbox-signal-${sig.status}`}
                          >
                            {sig.label}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary inbox-sort-cta"
                        onClick={() => handleSortAndImport(group)}
                      >
                        Sort & import
                      </button>
                      {group.detectedColumnsSummary && group.detectedColumnsSummary.length > 0 && (
                        <details className="inbox-advanced">
                          <summary>Advanced</summary>
                          <div className="inbox-columns-summary">
                            {group.detectedColumnsSummary
                              .filter((c) => c.field !== 'siteId')
                              .map((c) => (
                                <div key={c.field}>
                                  <span className="inbox-col-field">{humanizeFieldName(c.field)}</span>
                                  <span className="inbox-col-source">← {c.sourceColumn}</span>
                                </div>
                              ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Could not load inbox. Try again or choose a sheet below.</p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep('choose-sheet')}
                  >
                    Choose a sheet
                  </button>
                </div>
              )}
            </div>
          ) : step === 'preview' && previewResult && selectedSheet ? (
            /* Preview: Will create/update/skip, then Import assets */
            <div className="preview-step-panel">
              <div className="panel-header">
                <h3>What will happen</h3>
              </div>
              <div className="outcome-cards">
                <div className="outcome-card create">
                  <div className="outcome-value">{previewResult.created ?? 0}</div>
                  <div className="outcome-label">Will create</div>
                </div>
                <div className="outcome-card update">
                  <div className="outcome-value">{previewResult.updated ?? 0}</div>
                  <div className="outcome-label">Will update</div>
                </div>
                <div className="outcome-card skip">
                  <div className="outcome-value">
                    {(previewResult.unchanged ?? 0) + (previewResult.skipped ?? 0)}
                  </div>
                  <div className="outcome-label">Will skip</div>
                </div>
              </div>
              {previewResult.infoMessages && previewResult.infoMessages.length > 0 && (
                <div className="preview-info-messages">
                  {previewResult.infoMessages.map((msg, idx) => (
                    <div key={idx} className="info-message">{msg}</div>
                  ))}
                </div>
              )}
              <div className="preview-step-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep('sort')}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleImportFromPreview}
                  disabled={(previewResult.errors?.length ?? 0) > 0}
                >
                  Import assets
                </button>
              </div>
            </div>
          ) : (step === 'sort' || step === 'auto-extract') && selectedSheet ? (
            /* Sort: Quick config (location + assumptions), then Preview import */
            <div className="quick-import-panel">
              <div className="quick-import-panel-header">
                <h3>{selectedImport.filename}</h3>
                <span className="quick-import-sheet-name">{selectedSheet.sheetName}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-choose-sheet"
                  onClick={handleChooseDifferentSheet}
                >
                  Choose a different sheet
                </button>
              </div>
              <AutoExtract
                importId={selectedImport.id}
                sheetId={selectedSheet.id}
                sheetName={selectedSheet.sheetName}
                rowCount={selectedSheet.rowCount}
                onComplete={handleAutoExtractComplete}
                onBack={handleChooseDifferentSheet}
                onChooseDifferentSheet={handleChooseDifferentSheet}
                onPreview={handlePreviewReady}
              />
            </div>
          ) : step === 'choose-sheet' ? (
            /* Fallback: no sample data, sheet list only */
            <div className="choose-sheet-panel">
              <div className="panel-header">
                <h3>{selectedImport.filename}</h3>
              </div>
              {autoAnalysisFailed && (
                <p className="choose-sheet-message">
                  We couldn't automatically prepare this file. Choose a sheet to continue.
                </p>
              )}
              <div className="sheet-list-cards">
                {selectedImport.sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    className="sheet-list-card"
                    onClick={() => handlePickSheetForQuickImport(sheet)}
                  >
                    <span className="sheet-list-card-name">{sheet.sheetName}</span>
                    <span className="sheet-list-card-rows">{sheet.rowCount} rows</span>
                  </button>
                ))}
              </div>
              <div className="choose-sheet-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedSheet(selectedImport.sheets[0]);
                    setStep('choose-method');
                  }}
                >
                  Use full mapping instead
                </button>
              </div>
            </div>
          ) : (
            /* Legacy: choose-method, template, mapping, readiness, complete — minimal chrome, no sample data by default */
            <>
              <div className="panel-header">
                <h3>{selectedImport.filename}</h3>
              </div>
              <div className="sheet-tabs">
                {selectedImport.sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    className={`sheet-tab ${selectedSheet?.id === sheet.id ? 'active' : ''}`}
                    onClick={() => setSelectedSheet(sheet)}
                  >
                    {sheet.sheetName}
                    <span className="row-count">({sheet.rowCount} rows)</span>
                  </button>
                ))}
              </div>

              {selectedSheet && (
                <div className="sheet-preview">
                  {/* No column headers or sample data in default flow */}

                  {step === 'choose-method' && (
                    <div className="import-method-selection">
                      <h4>Choose Import Method</h4>
                      <p className="hint">
                        Select how you want to import data from "{selectedSheet.sheetName}".
                      </p>
                      <div className="method-cards">
                        <div
                          className="method-card recommended"
                          onClick={handleChooseAutoExtract}
                        >
                          <div className="method-badge">Recommended</div>
                          <h5>Quick Import (Auto-Extract)</h5>
                          <p>
                            Auto-detect columns and apply sheet-level defaults.
                          </p>
                        </div>
                        <div
                          className="method-card"
                          onClick={handleChooseFullMapping}
                        >
                          <h5>Full Mapping</h5>
                          <p>
                            Manually map each column. Use for complex spreadsheets.
                          </p>
                        </div>
                      </div>
                      <div className="method-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleBackToSelect}>
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step: Template Selection */}
                  {step === 'template' && (
                    <div className="template-selection">
                      <h4>Select Mapping Template</h4>
                      {bestMatch && bestMatch.confidence >= 0.7 && (
                        <div className="recommended-template">
                          <div className="recommendation-badge">Recommended</div>
                          <div className="template-card recommended" onClick={() => handleSelectTemplate(bestMatch.templateId)}>
                            <div className="template-name">{bestMatch.templateName}</div>
                            <div className="template-confidence">
                              {Math.round(bestMatch.confidence * 100)}% match
                            </div>
                            <div className="template-details">
                              {bestMatch.matchedColumns} of {bestMatch.totalTemplateColumns} columns matched
                            </div>
                          </div>
                        </div>
                      )}

                      {templateMatches.length > 0 && (
                        <div className="template-list">
                          <h5>Available Templates</h5>
                          {templateMatches
                            .filter((t) => t.templateId !== bestMatch?.templateId)
                            .map((match) => (
                              <div
                                key={match.templateId}
                                className="template-card"
                                onClick={() => handleSelectTemplate(match.templateId)}
                              >
                                <div className="template-name">{match.templateName}</div>
                                <div className="template-confidence">
                                  {Math.round(match.confidence * 100)}% match
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="template-actions">
                        <button className="btn btn-secondary" onClick={handleBackToSelect}>
                          Back
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateNewMapping}>
                          Create New Mapping
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step: Mapping Editor */}
                  {step === 'mapping' && selectedImport && selectedSheet && (
                    <MappingEditor
                      importId={selectedImport.id}
                      sheet={selectedSheet}
                      targetEntity={targetEntity}
                      onSave={handleMappingSaved}
                      onCancel={handleMappingCancelled}
                    />
                  )}

                  {/* Step: Readiness Gate */}
                  {step === 'readiness' && selectedImport && selectedSheet && selectedMapping && (
                    <ReadinessGate
                      importId={selectedImport.id}
                      sheetId={selectedSheet.id}
                      mappingId={selectedMapping.id}
                      mappingName={selectedMapping.name}
                      onExecute={handleExecuteComplete}
                      onBack={() => {
                        if (templateMatches.length > 0) {
                          setStep('template');
                        } else {
                          setStep('mapping');
                        }
                      }}
                    />
                  )}

                  {/* Step: Complete (Commit success) */}
                  {step === 'complete' && (lastResult || autoExtractResult) && (
                    <div className="import-complete">
                      {(() => {
                        const result = lastResult || autoExtractResult!;
                        const isAutoExtract = !!autoExtractResult;
                        const totalImported = result.created + result.updated;
                        return (
                          <>
                            <div className={`complete-status ${result.success ? 'success' : 'partial'}`}>
                              <h4>
                                {result.success
                                  ? `Imported ${totalImported} asset${totalImported !== 1 ? 's' : ''}`
                                  : 'Import completed with issues'}
                              </h4>
                            </div>

                            <div className="result-summary">
                              <div className="result-card created">
                                <div className="result-value">{result.created}</div>
                                <div className="result-label">Created</div>
                              </div>
                              <div className="result-card updated">
                                <div className="result-value">{result.updated}</div>
                                <div className="result-label">Updated</div>
                              </div>
                              <div className="result-card skipped">
                                <div className="result-value">{result.unchanged + result.skipped}</div>
                                <div className="result-label">Skipped</div>
                              </div>
                              {result.errors.length > 0 && (
                                <div className="result-card errors">
                                  <div className="result-value">{result.errors.length}</div>
                                  <div className="result-label">Errors</div>
                                </div>
                              )}
                            </div>

                            {/* Auto-Extract: Show assumed fields report */}
                            {isAutoExtract && autoExtractResult?.assumedFields && autoExtractResult.assumedFields.length > 0 && (
                              <div className="assumed-fields-summary">
                                <h5>Fields Using Defaults</h5>
                                <p className="hint">
                                  The following fields were set from sheet-level defaults 
                                  (not from Excel data):
                                </p>
                                <table className="assumed-fields-table">
                                  <thead>
                                    <tr>
                                      <th>Field</th>
                                      <th>Default Value</th>
                                      <th>Source</th>
                                      <th>Applied To</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {autoExtractResult.assumedFields.map((stat, idx) => (
                                      <tr key={idx}>
                                        <td>{humanizeFieldName(stat.field)}</td>
                                        <td><strong>{stat.value}</strong></td>
                                        <td>
                                          <span className={`source-badge ${stat.source}`}>
                                            {stat.source === 'sheet-default' 
                                              ? 'Sheet Default' 
                                              : 'Asset Type Default'}
                                          </span>
                                        </td>
                                        <td>{stat.rowCount} asset(s)</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Derived identity warning */}
                            {result.derivedIdentityCount > 0 && (
                              <div className="derived-identity-summary">
                                <strong>⚠️ Fallback Identities:</strong>{' '}
                                {result.derivedIdentityCount} asset(s) were created with 
                                auto-generated identities. These should be updated with 
                                real utility IDs later.
                              </div>
                            )}

                            {result.sampleErrors.length > 0 && (
                              <div className="error-details">
                                <h5>Error Details</h5>
                                <ul>
                                  {result.sampleErrors.map((err, idx) => (
                                    <li key={idx}>Row {err.row}: {err.message}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="complete-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => navigateToTab('assets')}
                              >
                                Go to Your Infrastructure
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleImportAnotherFile}
                              >
                                Import another file
                              </button>
                              {selectedImport && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => setSanitySummaryImportId(selectedImport.id)}
                                >
                                  View Summary
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Post-Import Sanity Summary Modal */}
      {sanitySummaryImportId && (
        <SanitySummaryModal
          importId={sanitySummaryImportId}
          isOpen={!!sanitySummaryImportId}
          onClose={() => setSanitySummaryImportId(null)}
        />
      )}
    </div>
  );
};
