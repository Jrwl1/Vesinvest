import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listImports, uploadExcel, deleteImport, getSheetPreview } from '../api';
import type { ExcelImport, ExcelSheet, TargetEntity } from '../types';
import { MappingEditor } from '../components/MappingEditor';

interface SheetPreview {
  id: string;
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
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
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [targetEntity, setTargetEntity] = useState<TargetEntity>('asset');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setShowMappingEditor(false);
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

  const handleOpenMappingEditor = () => {
    setShowMappingEditor(true);
  };

  const handleMappingSaved = (mappingId: string) => {
    setShowMappingEditor(false);
    // Could navigate to import execution or show success message
    alert(`Mapping saved with ID: ${mappingId}. You can now use this mapping to import data.`);
  };

  const handleMappingCancelled = () => {
    setShowMappingEditor(false);
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

                  {!showMappingEditor && (
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
                      <button className="btn btn-primary" onClick={handleOpenMappingEditor}>
                        Configure Mapping
                      </button>
                    </div>
                  )}

                  {showMappingEditor && selectedImport && selectedSheet && (
                    <MappingEditor
                      importId={selectedImport.id}
                      sheet={selectedSheet}
                      targetEntity={targetEntity}
                      onSave={handleMappingSaved}
                      onCancel={handleMappingCancelled}
                    />
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
