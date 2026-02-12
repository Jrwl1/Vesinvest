import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  previewKvaImport,
  confirmKvaImport,
  type KvaPreviewResult,
  type KvaSubtotalLine,
} from '../api';
import { formatCurrency } from '../utils/format';

interface KvaImportPreviewProps {
  onImportComplete: (budgetId: string) => void;
  onClose: () => void;
}

/** Map English ValisummaType to Finnish display label. */
const TYPE_DISPLAY: Record<string, string> = {
  income: 'Tulot',
  cost: 'Kulut',
  depreciation: 'Poistot',
  financial: 'Rahoitus',
  investment: 'Investoinnit',
  result: 'Tulos',
};

/** Map categoryKey type to DB tyyppi value. */
function typeToTyyppi(type: string): string {
  switch (type) {
    case 'income': return 'tulo';
    case 'cost': return 'kulu';
    case 'depreciation': return 'poisto';
    case 'financial': return type.includes('income') ? 'rahoitus_tulo' : 'rahoitus_kulu';
    case 'investment': return 'investointi';
    case 'result': return 'tulos';
    default: return 'kulu';
  }
}

/** Map a subtotal line's type + categoryKey to DB tyyppi. */
function subtotalToTyyppi(line: KvaSubtotalLine): string {
  if (line.type === 'financial') {
    return line.categoryKey.includes('income') ? 'rahoitus_tulo' : 'rahoitus_kulu';
  }
  return typeToTyyppi(line.type);
}

/** Suffix for duplicate name: "KVA 2023" -> "KVA 2023 (2)", "KVA 2023 (2)" -> "KVA 2023 (3)". Exported for tests. */
export function nextSuffixedName(name: string): string {
  const m = name.trim().match(/^(.+?)\s*\((\d+)\)\s*$/);
  if (m) {
    const num = parseInt(m[2]!, 10) + 1;
    return `${m[1]!.trim()} (${num})`;
  }
  return `${name.trim()} (2)`;
}

/** Map backend validation message to actionable i18n key, or return null to use raw message. */
function kvaValidationMessageKey(message: string | undefined): string | null {
  if (!message) return null;
  if (message.includes('Selected year must be one of the years extracted') || message.includes('extractedYears')) return 'kva.validationYearNotExtracted';
  if (message.includes('Extracted totals') && message.includes('subtotalLines')) return 'kva.validationSubtotalLinesRequired';
  return null;
}

export const KvaImportPreview: React.FC<KvaImportPreviewProps> = ({ onImportComplete, onClose }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [preview, setPreview] = useState<KvaPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [budgetName, setBudgetName] = useState('');
  const [editedSubtotals, setEditedSubtotals] = useState<KvaSubtotalLine[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [resultBudgetId, setResultBudgetId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [importFileName, setImportFileName] = useState<string>('');

  // Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setLoading(true);
    setImportFileName(f.name);

    try {
      const result = await previewKvaImport(f);
      setPreview(result);
      const years = result.subtotalDebug?.selectedHistoricalYears ?? result.availableYears ?? [];
      setBudgetName(years.length > 0 ? `KVA ${years[0]}` : 'KVA Import');
      setEditedSubtotals(result.subtotalLines ?? []);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse KVA file');
    } finally {
      setLoading(false);
    }
  };

  // Update subtotal amount
  const updateSubtotalAmount = (idx: number, value: string) => {
    const num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num)) return;
    setEditedSubtotals((prev) => prev.map((s, i) => i === idx ? { ...s, amount: num } : s));
  };

  // Ref so we always send the latest input value (avoids stale closure if handler runs before state commit)
  const budgetNameRef = useRef(budgetName);
  useEffect(() => {
    budgetNameRef.current = budgetName;
  }, [budgetName]);

  const extractedYears = preview?.subtotalDebug?.selectedHistoricalYears ?? preview?.availableYears ?? [];

  // Confirm: create one budget per extracted year (base name + " " + year); no single-year Vuosi selector.
  const handleConfirm = async () => {
    const baseName = (budgetNameRef.current ?? budgetName).trim();
    if (!preview || !baseName || extractedYears.length === 0) return;
    setConfirming(true);
    setError(null);
    setNameError(null);

    const buildPayload = (year: number, nimi: string) => {
      const linesForYear = editedSubtotals.filter((s) => s.year == null || s.year === year);
      const subtotalLines = linesForYear.map((s) => ({
        palvelutyyppi: (s.palvelutyyppi ?? 'muu') as 'vesi' | 'jatevesi' | 'muu',
        categoryKey: s.categoryKey,
        tyyppi: subtotalToTyyppi(s),
        summa: s.amount,
        label: s.categoryName,
        lahde: 'KVA',
        year: s.year,
        level: s.level,
        order: s.order,
      }));
      return {
        nimi,
        vuosi: year,
        subtotalLines,
        extractedYears,
      };
    };

    try {
      const batchId = crypto.randomUUID();
      let lastBudgetId: string | undefined;
      for (const year of extractedYears) {
        const nimi = extractedYears.length > 1 ? `${baseName} ${year}` : baseName;
        const payload = {
          ...buildPayload(year, nimi),
          importBatchId: batchId,
          importSourceFileName: importFileName || undefined,
        };
        const result = await confirmKvaImport(payload);
        lastBudgetId = result.budgetId;
      }
      if (lastBudgetId) {
        setResultBudgetId(lastBudgetId);
        setBudgetName(extractedYears.length > 1 ? `${baseName} ${extractedYears[extractedYears.length - 1]}` : baseName);
        setStep('done');
        onImportComplete(lastBudgetId);
      }
    } catch (err: any) {
      const key = kvaValidationMessageKey(err?.message);
      setError(key ? t(key) : err?.message || 'Failed to create budget profile');
    } finally {
      setConfirming(false);
    }
  };

  // Copy debug data
  const copyDiagnostics = () => {
    if (!preview) return;
    const debugData = {
      kvaDebug: preview.kvaDebug,
      driversDebug: preview.driversDebug,
      subtotalDebug: preview.subtotalDebug,
      warnings: preview.warnings,
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
  };

  // Group subtotals by year, sorted by level then order
  const byYear = editedSubtotals.reduce<Record<number, KvaSubtotalLine[]>>((acc, s) => {
    const y = s.year ?? 0;
    if (!acc[y]) acc[y] = [];
    acc[y].push(s);
    return acc;
  }, {});
  const yearsSorted = Object.keys(byYear).map(Number).filter((y) => !isNaN(y)).sort((a, b) => a - b);
  yearsSorted.forEach((y) => {
    byYear[y]!.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.order ?? 0) - (b.order ?? 0));
  });

  // Year-by-year totals (sum of amounts per year for preview)
  const totalsByYear = editedSubtotals.reduce<Record<number, number>>((acc, s) => {
    const y = s.year;
    if (y == null) return acc;
    acc[y] = (acc[y] ?? 0) + (typeof s.amount === 'number' ? s.amount : 0);
    return acc;
  }, {});
  const yearsWithTotals = Object.keys(totalsByYear)
    .map(Number)
    .filter((y) => !isNaN(y))
    .sort((a, b) => a - b);

  return (
    <div className="budget-import-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kva-import-modal card">
        {/* Header */}
        <div className="import-header">
          <h3>KVA Import</h3>
          <button className="btn-icon" onClick={onClose} title="Sulje">✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="import-upload">
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">📊</div>
              <p>Valitse KVA.xlsx-tiedosto</p>
              <span className="upload-formats">Excel (.xlsx, .xls)</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {loading && <p className="loading-text">Analysoidaan tiedostoa...</p>}
          </div>
        )}

        {/* Step 2: Preview — regression: three-year totals and warnings; root release-check (S-05) */}
        {step === 'preview' && preview && (
          <div className="kva-preview">
            <p className="kva-preview-intro">{t('kva.previewIntro')}</p>
            <p className="kva-confirm-copy">{t('kva.confirmCopy')}</p>
            {yearsWithTotals.length > 0 && (
              <div className="kva-year-totals">
                <span className="kva-year-totals-label">{t('kva.yearTotalsLabel')}:</span>
                {' '}
                {yearsWithTotals.map((y, i) => (
                  <React.Fragment key={y}>
                    {i > 0 && ', '}
                    <span className="kva-year-total">
                      {t('kva.yearTotalLine', { year: y, amount: formatCurrency(totalsByYear[y] ?? 0) })}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
            {/* Header controls */}
            <div className="kva-preview-controls">
              <div className="kva-control-group">
                <label>Nimi</label>
                <input
                  type="text"
                  value={budgetName}
                  onChange={(e) => {
                    const v = e.target.value;
                    console.log('[KVA name onChange]:', v);
                    setBudgetName(v);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Budjetin nimi"
                  className={`kva-input ${nameError ? 'input-error' : ''}`}
                />
                {nameError && <span className="kva-input-error">{nameError}</span>}
              </div>
            </div>

            {/* Section A: Year-by-year totals (detected years as cards, expandable by year; Tulot/Kulut/Poistot/Investoinnit via type) */}
            <div className="kva-section kva-year-sections">
              <h4 className="kva-section-title">Talousarvio (välisummat per vuosi)</h4>
              {yearsSorted.length === 0 ? (
                <p className="kva-empty">Välisummarivejä ei löydetty tiedostosta.</p>
              ) : (
                yearsSorted.map((year) => {
                  const lines = byYear[year] ?? [];
                  const yearTotal = lines.reduce((sum, s) => sum + (typeof s.amount === 'number' ? s.amount : 0), 0);
                  const isExpanded = expandedYears.has(year);
                  const bucketTotals = { income: 0, cost: 0, depreciation: 0, investment: 0 };
                  lines.forEach((s) => {
                    if (s.type === 'income' || s.type === 'financial') bucketTotals.income += typeof s.amount === 'number' ? s.amount : 0;
                    else if (s.type === 'cost') bucketTotals.cost += typeof s.amount === 'number' ? s.amount : 0;
                    else if (s.type === 'depreciation') bucketTotals.depreciation += typeof s.amount === 'number' ? s.amount : 0;
                    else if (s.type === 'investment') bucketTotals.investment += typeof s.amount === 'number' ? s.amount : 0;
                  });
                  return (
                    <div key={year} className="kva-year-card" data-testid={`kva-year-card-${year}`}>
                      <h5
                        className="kva-year-card-title"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedYears((prev) => { const n = new Set(prev); if (n.has(year)) n.delete(year); else n.add(year); return n; })}
                        onKeyDown={(e) => e.key === 'Enter' && setExpandedYears((prev) => { const n = new Set(prev); if (n.has(year)) n.delete(year); else n.add(year); return n; })}
                      >
                        {isExpanded ? '▼' : '▶'} Vuosi {year}
                        <span className="kva-year-total-badge">{formatCurrency(yearTotal)}</span>
                      </h5>
                      {!isExpanded && (
                        <div className="kva-bucket-totals">
                          <span>{TYPE_DISPLAY.income}: {formatCurrency(bucketTotals.income)}</span>
                          <span>{TYPE_DISPLAY.cost}: {formatCurrency(bucketTotals.cost)}</span>
                          <span>{TYPE_DISPLAY.depreciation}: {formatCurrency(bucketTotals.depreciation)}</span>
                          <span>{TYPE_DISPLAY.investment}: {formatCurrency(bucketTotals.investment)}</span>
                        </div>
                      )}
                      {isExpanded && (
                      <table className="kva-subtotal-table">
                        <thead>
                          <tr>
                            <th>Kategoria</th>
                            <th>Tyyppi</th>
                            <th className="num-col">Summa (€)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((s, i) => {
                            const idx = editedSubtotals.findIndex((x) => x === s);
                            return (
                              <tr key={`${year}-${i}`} className={s.type === 'result' ? 'kva-result-row' : ''}>
                                <td>
                                  <span className={`kva-category-name kva-level-${s.level ?? 0}`}>{s.categoryName}</span>
                                  {s.palvelutyyppi && (
                                    <span className="kva-service-badge">{s.palvelutyyppi}</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`type-badge type-${s.type}`}>
                                    {TYPE_DISPLAY[s.type] ?? s.type}
                                  </span>
                                </td>
                                <td className="num-col">
                                  {s.type === 'result' ? (
                                    <span className="kva-computed">{formatCurrency(s.amount)}</span>
                                  ) : (
                                    <input
                                      type="text"
                                      className="kva-amount-input"
                                      value={s.amount}
                                      onChange={(e) => idx >= 0 && updateSubtotalAmount(idx, e.target.value)}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Warnings */}
            {preview.warnings.filter((w) => !w.includes('[KVA_DEBUG]') && !/revenue\s*driver|tuloajuri|template\s*missing|blad1/i.test(w)).length > 0 && (
              <div className="kva-section">
                <div className="kva-warnings">
                  {preview.warnings
                    .filter((w) => !w.includes('[KVA_DEBUG]') && !/revenue\s*driver|tuloajuri|template\s*missing|blad1/i.test(w))
                    .map((w, i) => (
                      <div key={i} className="kva-warning-item">⚠ {w}</div>
                    ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="kva-footer">
              <div className="kva-footer-left">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setStep('upload'); setPreview(null); }}
                  disabled={confirming}
                >
                  ← Valitse toinen tiedosto
                </button>
                <button className="btn btn-ghost" onClick={copyDiagnostics} title="Kopioi diagnostiikka">
                  📋 Diagnostiikka
                </button>
              </div>
              <button
                className="btn btn-primary kva-confirm-btn"
                data-testid="kva-confirm-btn"
                onClick={handleConfirm}
                disabled={confirming || !budgetName.trim() || extractedYears.length === 0}
              >
                {confirming ? 'Luodaan...' : t('kva.confirmCta')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="import-done">
            <div className="done-icon">✅</div>
            <h4>Budjetti luotu</h4>
            <p>Budjetti "{budgetName}" on luotu onnistuneesti.</p>
            <button className="btn btn-primary" onClick={onClose}>
              Sulje
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
