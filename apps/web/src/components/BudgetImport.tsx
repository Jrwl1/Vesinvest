import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  importBudgetPreview,
  importBudgetConfirm,
  type ImportPreviewRow,
  type ImportPreviewResult,
} from '../api';
import { formatCurrency } from '../utils/format';

interface BudgetImportProps {
  budgetId: string;
  onImportComplete: () => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  tulo: 'revenue',
  kulu: 'expenses',
  investointi: 'investments',
};

export const BudgetImport: React.FC<BudgetImportProps> = ({ budgetId, onImportComplete, onClose }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  // Upload & preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setLoading(true);

    try {
      const previewResult = await importBudgetPreview(budgetId, f);
      setPreview(previewResult);
      // Select all rows by default
      setSelectedRows(new Set(previewResult.rows.map((_, i) => i)));
      setStep('preview');
    } catch (err: any) {
      setError(err.message || t('import.parseFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Confirm import
  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);

    const rowsToImport = preview.rows.filter((_, i) => selectedRows.has(i));
    try {
      const res = await importBudgetConfirm(budgetId, rowsToImport);
      setResult({ created: res.created, skipped: res.skipped });
      setStep('done');
      onImportComplete();
    } catch (err: any) {
      setError(err.message || t('import.confirmFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedRows.size === preview.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(preview.rows.map((_, i) => i)));
    }
  };

  // Group counts for summary
  const getGroupCounts = (rows: ImportPreviewRow[]) => {
    const counts = { tulo: 0, kulu: 0, investointi: 0 };
    const totals = { tulo: 0, kulu: 0, investointi: 0 };
    rows.forEach((r, i) => {
      if (selectedRows.has(i)) {
        counts[r.tyyppi]++;
        totals[r.tyyppi] += r.summa;
      }
    });
    return { counts, totals };
  };

  return (
    <div className="budget-import-overlay">
      <div className="budget-import card">
        <div className="import-header">
          <h3>{t('import.title')}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="import-upload">
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">📁</div>
              <p>{t('import.dropHint')}</p>
              <span className="upload-formats">{t('import.formats')}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {loading && <p className="loading-text">{t('import.parsing')}</p>}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="import-preview">
            <div className="preview-info">
              <span className="format-badge">{preview.detectedFormat}</span>
              <span>
                {preview.rows.length} {t('import.rowsDetected')}
                {preview.skippedRows > 0 && (
                  <span className="muted"> ({preview.skippedRows} {t('import.rowsSkipped')})</span>
                )}
              </span>
            </div>

            {preview.warnings.length > 0 && (
              <div className="import-warnings">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="warning-item">⚠ {w}</div>
                ))}
              </div>
            )}

            {/* Summary by type */}
            {(() => {
              const { counts, totals } = getGroupCounts(preview.rows);
              return (
                <div className="import-summary">
                  {(['tulo', 'kulu', 'investointi'] as const).map((type) => (
                    counts[type] > 0 && (
                      <div key={type} className="summary-chip">
                        <span className="chip-label">{t(`budget.sections.${TYPE_LABELS[type]}`)}</span>
                        <span className="chip-count">{counts[type]}</span>
                        <span className="chip-total">{formatCurrency(totals[type])}</span>
                      </div>
                    )
                  ))}
                </div>
              );
            })()}

            {/* Row table */}
            <div className="import-table-wrapper">
              <table className="import-table">
                <thead>
                  <tr>
                    <th className="check-col">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === preview.rows.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>{t('budget.accountGroup')}</th>
                    <th>{t('budget.name')}</th>
                    <th>{t('import.type')}</th>
                    <th className="num-col">{t('budget.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className={selectedRows.has(i) ? '' : 'deselected-row'}>
                      <td className="check-col">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(i)}
                          onChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="code-cell">{row.tiliryhma}</td>
                      <td>{row.nimi}</td>
                      <td>
                        <span className={`type-badge type-${row.tyyppi}`}>
                          {t(`budget.sections.${TYPE_LABELS[row.tyyppi]}`)}
                        </span>
                      </td>
                      <td className="num-col">{formatCurrency(row.summa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="import-actions">
              <button className="btn-secondary" onClick={() => { setStep('upload'); setPreview(null); setFile(null); }}>
                ← {t('import.chooseAnother')}
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={loading || selectedRows.size === 0}
              >
                {loading ? t('import.importing') : `${t('import.confirm')} (${selectedRows.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && result && (
          <div className="import-done">
            <div className="done-icon">✅</div>
            <h4>{t('import.success')}</h4>
            <p>
              {t('import.createdLines', { count: result.created })}
              {result.skipped > 0 && ` (${result.skipped} ${t('import.rowsSkipped')})`}
            </p>
            <button className="btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
