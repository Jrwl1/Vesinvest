import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  previewKvaImport,
  confirmKvaImport,
  type KvaPreviewResult,
  type KvaSubtotalLine,
  type ImportRevenueDriver,
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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [editedSubtotals, setEditedSubtotals] = useState<KvaSubtotalLine[]>([]);
  const [editedDrivers, setEditedDrivers] = useState<ImportRevenueDriver[]>([]);
  const [includeAccountLines, setIncludeAccountLines] = useState(false);
  const [showAccountDetail, setShowAccountDetail] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultBudgetId, setResultBudgetId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setLoading(true);

    try {
      const result = await previewKvaImport(f);
      setPreview(result);
      setBudgetName(result.year ? `KVA ${result.year}` : 'KVA Import');
      setSelectedYear(result.year ?? result.availableYears?.[result.availableYears.length - 1] ?? null);
      setEditedSubtotals(result.subtotalLines ?? []);
      setEditedDrivers(result.revenueDrivers ?? []);
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

  // Update driver field
  const updateDriver = (palvelutyyppi: string, field: string, value: string) => {
    const num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    setEditedDrivers((prev) =>
      prev.map((d) =>
        d.palvelutyyppi === palvelutyyppi
          ? { ...d, [field]: isNaN(num) ? undefined : num }
          : d,
      ),
    );
  };

    // Ref so we always send the latest input value (avoids stale closure if handler runs before state commit)
  const budgetNameRef = useRef(budgetName);
  useEffect(() => {
    budgetNameRef.current = budgetName;
  }, [budgetName]);

  // Confirm: use ref so we always send the current input value; on 409 try suffixed names (2)..(10)
  const handleConfirm = async () => {
    const currentName = (budgetNameRef.current ?? budgetName).trim();
    if (!preview || !selectedYear || !currentName) return;
    setConfirming(true);
    setError(null);
    setNameError(null);

    const buildPayload = (nimi: string) => {
      const subtotalLines = editedSubtotals.map((s) => ({
        palvelutyyppi: (s.palvelutyyppi ?? 'muu') as 'vesi' | 'jatevesi' | 'muu',
        categoryKey: s.categoryKey,
        tyyppi: subtotalToTyyppi(s),
        summa: s.amount,
        label: s.categoryName,
        lahde: 'KVA',
      }));
      // Include drivers with any meaningful field (match backend "meaningful" check)
      const revenueDrivers = editedDrivers
        .filter(
          (d) =>
            (d.yksikkohinta ?? 0) > 0 ||
            (d.myytyMaara ?? 0) > 0 ||
            (d.liittymamaara ?? 0) > 0 ||
            (d.perusmaksu ?? 0) > 0,
        )
        .map((d) => ({
          palvelutyyppi: d.palvelutyyppi,
          yksikkohinta: d.yksikkohinta ?? 0,
          myytyMaara: d.myytyMaara ?? 0,
          perusmaksu: d.perusmaksu,
          liittymamaara: d.liittymamaara,
          alvProsentti: d.alvProsentti,
        }));
      return {
        nimi,
        vuosi: selectedYear,
        subtotalLines,
        revenueDrivers,
        accountLines: includeAccountLines ? preview.rows : undefined,
      };
    };

    try {
      const payload = buildPayload(currentName);
      const result = await confirmKvaImport(payload);

      setResultBudgetId(result.budgetId);
      setBudgetName(payload.nimi);
      setStep('done');
      onImportComplete(result.budgetId);
    } catch (err: any) {
      const status = err?.status;
      if (status === 409) {
        const baseName = (budgetNameRef.current ?? budgetName).trim();
        for (let n = 2; n <= 10; n++) {
          const tryName = `${baseName} (${n})`;
          try {
            const retryPayload = buildPayload(tryName);
            console.log('[KVA confirm] 409 retry with nimi:', tryName);
            const result = await confirmKvaImport(retryPayload);
            setResultBudgetId(result.budgetId);
            setBudgetName(tryName);
            setStep('done');
            onImportComplete(result.budgetId);
            return;
          } catch (retryErr: any) {
            if (retryErr?.status !== 409) {
              const key = kvaValidationMessageKey(retryErr?.message);
              setError(key ? t(key) : retryErr?.message || 'Failed to create budget profile');
              return;
            }
          }
        }
        const msg = 'A budget with this name already exists for this year. We tried (2) to (10); please enter a different name.';
        setNameError(msg);
        setError(msg);
      } else {
        const key = kvaValidationMessageKey(err?.message);
        setError(key ? t(key) : err?.message || 'Failed to create budget profile');
      }
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

  // Group subtotals by type for display
  const groupedSubtotals = editedSubtotals.reduce<Record<string, KvaSubtotalLine[]>>((acc, s) => {
    const key = s.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

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

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="kva-preview">
            <p className="kva-preview-intro">{t('kva.previewIntro')}</p>
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
              <div className="kva-control-group">
                <label>Vuosi</label>
                <select
                  value={selectedYear ?? ''}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="kva-select"
                >
                  {(preview.availableYears ?? []).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section A: Budget overview (subtotals) */}
            <div className="kva-section">
              <h4 className="kva-section-title">Talousarvio (välisummat)</h4>
              {Object.entries(groupedSubtotals).length === 0 ? (
                <p className="kva-empty">Välisummarivejä ei löydetty tiedostosta.</p>
              ) : (
                <table className="kva-subtotal-table">
                  <thead>
                    <tr>
                      <th>Kategoria</th>
                      <th>Tyyppi</th>
                      <th className="num-col">Summa (€)</th>
                      <th>Lähde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedSubtotals.map((s, idx) => (
                      <tr key={idx} className={s.type === 'result' ? 'kva-result-row' : ''}>
                        <td>
                          <span className="kva-category-name">{s.categoryName}</span>
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
                              onChange={(e) => updateSubtotalAmount(idx, e.target.value)}
                            />
                          )}
                        </td>
                        <td className="kva-source">{s.sourceSheet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section B: Revenue drivers */}
            <div className="kva-section">
              <h4 className="kva-section-title">Tuloajurit</h4>
              <table className="kva-drivers-table">
                <thead>
                  <tr>
                    <th></th>
                    <th className="num-col">Yksikköhinta (€/m³)</th>
                    <th className="num-col">Volyymi (m³/a)</th>
                    <th className="num-col">Liittymät</th>
                    <th className="num-col">Perusmaksu (€/liit.)</th>
                    <th className="num-col">ALV %</th>
                  </tr>
                </thead>
                <tbody>
                  {editedDrivers.map((d) => (
                    <tr key={d.palvelutyyppi}>
                      <td className="kva-driver-label">
                        {d.palvelutyyppi === 'vesi' ? 'Vesi' : d.palvelutyyppi === 'jatevesi' ? 'Jätevesi' : d.palvelutyyppi}
                      </td>
                      <td className="num-col">
                        <input
                          type="text"
                          className="kva-amount-input small"
                          value={d.yksikkohinta ?? ''}
                          onChange={(e) => updateDriver(d.palvelutyyppi, 'yksikkohinta', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="num-col">
                        <input
                          type="text"
                          className="kva-amount-input small"
                          value={d.myytyMaara ?? ''}
                          onChange={(e) => updateDriver(d.palvelutyyppi, 'myytyMaara', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="num-col">
                        <input
                          type="text"
                          className="kva-amount-input small"
                          value={d.liittymamaara ?? ''}
                          onChange={(e) => updateDriver(d.palvelutyyppi, 'liittymamaara', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="num-col">
                        <input
                          type="text"
                          className="kva-amount-input small"
                          value={d.perusmaksu ?? ''}
                          onChange={(e) => updateDriver(d.palvelutyyppi, 'perusmaksu', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="num-col">
                        <input
                          type="text"
                          className="kva-amount-input small"
                          value={d.alvProsentti ?? ''}
                          onChange={(e) => updateDriver(d.palvelutyyppi, 'alvProsentti', e.target.value)}
                          placeholder="25.5"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {editedDrivers.some((d) => d.alvProsentti != null && d.alvProsentti > 0) && (
                <p className="kva-hint">Yksikköhinnat ex ALV. ALV lisätään erikseen laskennassa.</p>
              )}
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="kva-section">
                <div className="kva-warnings">
                  {preview.warnings
                    .filter((w) => !w.includes('[KVA_DEBUG]'))
                    .map((w, i) => (
                      <div key={i} className="kva-warning-item">⚠ {w}</div>
                    ))}
                </div>
              </div>
            )}

            {/* Advanced: account detail (collapsed) */}
            <div className="kva-section">
              <button
                className="kva-collapse-toggle"
                onClick={() => setShowAccountDetail(!showAccountDetail)}
              >
                {showAccountDetail ? '▾' : '▸'} Tilitason rivit (Blad1) — {preview.rows.length} riviä
              </button>
              {showAccountDetail && (
                <div className="kva-account-detail">
                  <label className="kva-checkbox">
                    <input
                      type="checkbox"
                      checked={includeAccountLines}
                      onChange={(e) => setIncludeAccountLines(e.target.checked)}
                    />
                    Tallenna myös tilitason rivit (valinnainen)
                  </label>
                  {preview.rows.length > 0 && (
                    <table className="import-table compact">
                      <thead>
                        <tr>
                          <th>Tili</th>
                          <th>Nimi</th>
                          <th>Tyyppi</th>
                          <th className="num-col">Summa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 50).map((row, i) => (
                          <tr key={i}>
                            <td className="code-cell">{row.tiliryhma}</td>
                            <td>{row.nimi}</td>
                            <td><span className={`type-badge type-${row.tyyppi}`}>{row.tyyppi}</span></td>
                            <td className="num-col">{formatCurrency(row.summa)}</td>
                          </tr>
                        ))}
                        {preview.rows.length > 50 && (
                          <tr><td colSpan={4} className="kva-more">...ja {preview.rows.length - 50} muuta riviä</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

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
                onClick={handleConfirm}
                disabled={confirming || !budgetName.trim() || !selectedYear}
              >
                {confirming ? 'Luodaan...' : `Luo budjetti "${budgetName.trim()}"`}
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
