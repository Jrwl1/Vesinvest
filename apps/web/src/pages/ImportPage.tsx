import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  listImports,
  uploadExcel,
  deleteImport,
  getSheetPreview,
  findMatchingTemplates,
  listTemplates,
} from '../api';
import type {
  ExcelImport,
  ExcelSheet,
  TargetEntity,
  ImportMapping,
  TemplateMatchResult,
  ImportExecutionResult,
  ColumnProfile,
} from '../types';
import { MappingEditor } from '../components/MappingEditor';
import { ReadinessGate } from '../components/ReadinessGate';

type ImportStep = 'select' | 'template' | 'mapping' | 'readiness' | 'complete';

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

  // New workflow state
  const [step, setStep] = useState<ImportStep>('select');
  const [templates, setTemplates] = useState<ImportMapping[]>([]);
  const [templateMatches, setTemplateMatches] = useState<TemplateMatchResult[]>([]);
  const [bestMatch, setBestMatch] = useState<TemplateMatchResult | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<ImportMapping | null>(null);
  const [lastResult, setLastResult] = useState<ImportExecutionResult | null>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const response = await uploadExcel(file);
      setImports((prev) => [response.import, ...prev]);
      setSelectedImport(response.import);
      if (response.import.sheets.length > 0) {
        setSelectedSheet(response.import.sheets[0]);
      }
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

  const handleSelectImport = (imp: ExcelImport) => {
    setSelectedImport(imp);
    setSelectedSheet(imp.sheets.length > 0 ? imp.sheets[0] : null);
    setSheetPreview(null);
  };

  const handleSelectSheet = async (sheet: ExcelSheet) => {
    setSelectedSheet(sheet);
    // Reset to select step if changing sheet
    if (step !== 'select') {
      setStep('select');
    }
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
      setStep('select');
    }
  };

  const handleExecuteComplete = (result: ImportExecutionResult) => {
    setLastResult(result);
    setStep('complete');
    // Refresh imports list to show new status
    fetchImports();
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedMapping(null);
    setTemplateMatches([]);
    setBestMatch(null);
    setLastResult(null);
  };

  useEffect(() => {
    if (selectedSheet && selectedImport) {
      handleSelectSheet(selectedSheet);
    }
  }, [selectedSheet?.id]);

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

        {/* Right Panel - Sheet Preview */}
        <div className="sheet-preview-panel">
          {!selectedImport ? (
            <div className="empty-state">
              <p>Select an import to view sheets and data preview.</p>
            </div>
          ) : (
            <>
              <div className="panel-header">
                <h3>{selectedImport.filename}</h3>
              </div>

              {/* Sheet Tabs */}
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

              {/* Sheet Preview */}
              {selectedSheet && (
                <div className="sheet-preview">
                  <div className="preview-header">
                    <h4>Column Headers</h4>
                    <span className="header-count">{selectedSheet.headers.length} columns detected</span>
                  </div>

                  <div className="columns-grid">
                    {selectedSheet.headers.map((header, idx) => (
                      <div key={idx} className="column-badge">
                        {header}
                      </div>
                    ))}
                  </div>

                  {previewLoading ? (
                    <div className="loading-spinner">Loading preview...</div>
                  ) : sheetPreview && sheetPreview.sampleRows.length > 0 ? (
                    <>
                      <div className="preview-header">
                        <h4>Sample Data</h4>
                        <span className="sample-count">
                          Showing {sheetPreview.sampleRows.length} of {selectedSheet.rowCount} rows
                        </span>
                      </div>

                      <div className="preview-table-container">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              {selectedSheet.headers.map((header, idx) => (
                                <th key={idx}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetPreview.sampleRows.map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                <td className="row-number">{rowIdx + 1}</td>
                                {selectedSheet.headers.map((header, colIdx) => (
                                  <td key={colIdx}>
                                    {row[header] !== null && row[header] !== undefined
                                      ? String(row[header])
                                      : <span className="null-value">-</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>No sample data available for this sheet.</p>
                    </div>
                  )}

                  {/* Step: Select - Show target entity and start button */}
                  {step === 'select' && (
                    <div className="preview-actions">
                      <div className="target-entity-select">
                        <label htmlFor="target-entity">Import as:</label>
                        <select
                          id="target-entity"
                          value={targetEntity}
                          onChange={(e) => setTargetEntity(e.target.value as TargetEntity)}
                        >
                          <option value="asset">Assets</option>
                          <option value="assetType">Asset Types</option>
                          <option value="site">Sites</option>
                          <option value="maintenanceItem">Maintenance Items</option>
                        </select>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleStartImport}
                        disabled={previewLoading}
                      >
                        {previewLoading ? 'Finding Templates...' : 'Start Import'}
                      </button>
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

                  {/* Step: Complete */}
                  {step === 'complete' && lastResult && (
                    <div className="import-complete">
                      <div className={`complete-status ${lastResult.success ? 'success' : 'partial'}`}>
                        <h4>{lastResult.success ? 'Import Complete!' : 'Import Completed with Issues'}</h4>
                      </div>

                      <div className="result-summary">
                        <div className="result-card created">
                          <div className="result-value">{lastResult.created}</div>
                          <div className="result-label">Created</div>
                        </div>
                        <div className="result-card updated">
                          <div className="result-value">{lastResult.updated}</div>
                          <div className="result-label">Updated</div>
                        </div>
                        <div className="result-card skipped">
                          <div className="result-value">{lastResult.unchanged + lastResult.skipped}</div>
                          <div className="result-label">Skipped</div>
                        </div>
                        {lastResult.errors.length > 0 && (
                          <div className="result-card errors">
                            <div className="result-value">{lastResult.errors.length}</div>
                            <div className="result-label">Errors</div>
                          </div>
                        )}
                      </div>

                      {lastResult.sampleErrors.length > 0 && (
                        <div className="error-details">
                          <h5>Error Details</h5>
                          <ul>
                            {lastResult.sampleErrors.map((err, idx) => (
                              <li key={idx}>Row {err.row}: {err.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="complete-actions">
                        <button className="btn btn-primary" onClick={handleBackToSelect}>
                          Import Another File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
