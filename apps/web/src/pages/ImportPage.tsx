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
} from '../types';
import { humanizeFieldName } from '../utils/format';
import { MappingEditor } from '../components/MappingEditor';
import { ReadinessGate } from '../components/ReadinessGate';
import { AutoExtract } from '../components/AutoExtract';
import { SanitySummaryModal } from '../components/SanitySummaryModal';
import { useNavigation } from '../context/NavigationContext';

type ImportStep =
  | 'inbox'          // After upload: list of groups (sheets) with signals
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

  // Load inbox when we have an import and are on inbox step
  useEffect(() => {
    if (step !== 'inbox' || !selectedImport) return;
    let cancelled = false;
    setInboxLoading(true);
    getImportInbox(selectedImport.id)
      .then((data) => {
        if (!cancelled) setInboxData(data);
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
      setStep(response.import.sheets.length > 0 ? 'inbox' : 'choose-sheet');
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
    setStep(imp.sheets.length > 0 ? 'inbox' : 'choose-sheet');
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

        {/* Right Panel: Inbox → Sort → Preview → Complete (or choose-sheet / legacy) */}
        <div className="sheet-preview-panel">
          {!selectedImport ? (
            <div className="empty-state">
              <p>Select an import or upload a file to get started.</p>
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
