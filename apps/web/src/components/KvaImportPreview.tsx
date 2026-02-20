import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  previewKvaImport,
  confirmKvaImport,
  type KvaPreviewResult,
  type KvaSubtotalLine,
  type ImportRevenueDriver,
} from '../api';
import { formatCurrency, formatDecimal } from '../utils/format';

export interface KvaImportCompleteResult {
  budgetId: string;
  importBatchId?: string;
}

type DriverService = 'vesi' | 'jatevesi';
type DriverField = 'yksikkohinta' | 'myytyMaara';
type DriversByYearState = Record<number, Record<DriverService, ImportRevenueDriver>>;

interface KvaImportPreviewProps {
  onImportComplete: (result: KvaImportCompleteResult) => void;
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
  if (message.includes('Required buckets missing')) return 'kva.validationMissingBucket';
  return null;
}

function toDriverServiceMap(
  drivers: ImportRevenueDriver[] | undefined,
): Record<DriverService, ImportRevenueDriver> {
  const water = drivers?.find((driver) => driver.palvelutyyppi === 'vesi') ?? { palvelutyyppi: 'vesi' };
  const wastewater = drivers?.find((driver) => driver.palvelutyyppi === 'jatevesi') ?? { palvelutyyppi: 'jatevesi' };
  return {
    vesi: { ...water },
    jatevesi: { ...wastewater },
  };
}

function buildDriverStateFromPreview(
  previewResult: KvaPreviewResult,
  years: number[],
): DriversByYearState {
  const state: DriversByYearState = {};
  const fallbackMap = toDriverServiceMap(previewResult.revenueDrivers);
  for (const year of years) {
    const perYear = previewResult.revenueDriversByYear?.[year];
    const map = toDriverServiceMap(perYear);
    state[year] = {
      vesi: { ...fallbackMap.vesi, ...map.vesi, palvelutyyppi: 'vesi' },
      jatevesi: { ...fallbackMap.jatevesi, ...map.jatevesi, palvelutyyppi: 'jatevesi' },
    };
  }
  return state;
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
  const [editedDriversByYear, setEditedDriversByYear] = useState<DriversByYearState>({});
  const [confirming, setConfirming] = useState(false);
  const [resultBudgetId, setResultBudgetId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set()); // 'year:bucketKey' for per-bucket expand
  const [importFileName, setImportFileName] = useState<string>('');
  const [selectedYears, setSelectedYears] = useState<number[]>([]); // when Excel has >3 years, user picks 3 (default 3 latest)
  const [reimportMode, setReimportMode] = useState<'replace_imported_scope' | 'replace_all'>('replace_imported_scope');

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
      const allYears = result.availableYears ?? result.subtotalDebug?.selectedHistoricalYears ?? [];
      const defaultThree = (result.subtotalDebug?.selectedHistoricalYears ?? allYears.slice(-3)).slice(-3);
      const selected = defaultThree.length >= 3 ? defaultThree : allYears.slice(-3);
      setSelectedYears(selected);
      setBudgetName(allYears.length > 0 ? `KVA ${allYears[allYears.length - 1]}` : 'KVA Import');
      setEditedSubtotals(result.subtotalLines ?? []);
      setEditedDriversByYear(buildDriverStateFromPreview(result, selected.length > 0 ? selected : allYears));
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse KVA file');
    } finally {
      setLoading(false);
    }
  };

  // Update subtotal amount (round to max 2 decimals for display/storage)
  const updateSubtotalAmount = (idx: number, value: string) => {
    const num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num)) return;
    const rounded = Math.round(num * 100) / 100;
    setEditedSubtotals((prev) => prev.map((s, i) => i === idx ? { ...s, amount: rounded } : s));
  };

  // Ref so we always send the latest input value (avoids stale closure if handler runs before state commit)
  const budgetNameRef = useRef(budgetName);
  useEffect(() => {
    budgetNameRef.current = budgetName;
  }, [budgetName]);

  const availableYears = preview?.availableYears ?? preview?.subtotalDebug?.selectedHistoricalYears ?? [];
  const extractedYears = selectedYears.length > 0 ? selectedYears.slice().sort((a, b) => a - b) : availableYears.slice(-3);

  useEffect(() => {
    if (!preview || extractedYears.length === 0) return;
    setEditedDriversByYear((prev) => {
      const next = { ...prev };
      const source = buildDriverStateFromPreview(preview, extractedYears);
      for (const year of extractedYears) {
        next[year] = {
          vesi: { ...(source[year]?.vesi ?? { palvelutyyppi: 'vesi' }), ...(next[year]?.vesi ?? {}), palvelutyyppi: 'vesi' },
          jatevesi: {
            ...(source[year]?.jatevesi ?? { palvelutyyppi: 'jatevesi' }),
            ...(next[year]?.jatevesi ?? {}),
            palvelutyyppi: 'jatevesi',
          },
        };
      }
      return next;
    });
  }, [preview, extractedYears.join(',')]);

  const getDriverValue = (year: number, service: DriverService, field: DriverField): number => {
    const fromState = editedDriversByYear[year]?.[service]?.[field];
    if (typeof fromState === 'number') return fromState;
    const fromPreviewByYear = preview?.revenueDriversByYear?.[year]?.find((d) => d.palvelutyyppi === service)?.[field];
    if (typeof fromPreviewByYear === 'number') return fromPreviewByYear;
    const fallback = preview?.revenueDrivers?.find((d) => d.palvelutyyppi === service)?.[field];
    return typeof fallback === 'number' ? fallback : 0;
  };

  const getOriginalDriverValue = (year: number, service: DriverService, field: DriverField): number => {
    const byYear = preview?.revenueDriversByYear?.[year]?.find((d) => d.palvelutyyppi === service)?.[field];
    if (typeof byYear === 'number') return byYear;
    const fallback = preview?.revenueDrivers?.find((d) => d.palvelutyyppi === service)?.[field];
    return typeof fallback === 'number' ? fallback : 0;
  };

  const upsertDriverValue = (
    year: number,
    service: DriverService,
    field: DriverField,
    rawValue: string,
  ) => {
    const parsed = parseFloat(rawValue.replace(/\s/g, '').replace(',', '.'));
    const safe = !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    setEditedDriversByYear((prev) => ({
      ...prev,
      [year]: {
        vesi: {
          palvelutyyppi: 'vesi',
          ...(prev[year]?.vesi ?? {}),
        },
        jatevesi: {
          palvelutyyppi: 'jatevesi',
          ...(prev[year]?.jatevesi ?? {}),
        },
        [service]: {
          ...(prev[year]?.[service] ?? { palvelutyyppi: service }),
          [field]: safe,
        },
      },
    }));
  };

  const copyFieldToAllYears = (service: DriverService, field: DriverField, fromYear: number) => {
    const value = getDriverValue(fromYear, service, field);
    setEditedDriversByYear((prev) => {
      const next = { ...prev };
      for (const year of extractedYears) {
        next[year] = {
          vesi: { palvelutyyppi: 'vesi', ...(next[year]?.vesi ?? {}) },
          jatevesi: { palvelutyyppi: 'jatevesi', ...(next[year]?.jatevesi ?? {}) },
          [service]: {
            ...(next[year]?.[service] ?? { palvelutyyppi: service }),
            [field]: value,
          },
        };
      }
      return next;
    });
  };

  const resetFieldToExtracted = (service: DriverService, field: DriverField) => {
    setEditedDriversByYear((prev) => {
      const next = { ...prev };
      for (const year of extractedYears) {
        const original = getOriginalDriverValue(year, service, field);
        next[year] = {
          vesi: { palvelutyyppi: 'vesi', ...(next[year]?.vesi ?? {}) },
          jatevesi: { palvelutyyppi: 'jatevesi', ...(next[year]?.jatevesi ?? {}) },
          [service]: {
            ...(next[year]?.[service] ?? { palvelutyyppi: service }),
            [field]: original,
          },
        };
      }
      return next;
    });
  };

  const requiredDriverMissing = extractedYears.flatMap((year) => {
    const misses: string[] = [];
    for (const service of ['vesi', 'jatevesi'] as const) {
      for (const field of ['yksikkohinta', 'myytyMaara'] as const) {
        if (getDriverValue(year, service, field) <= 0) {
          misses.push(`${year}:${service}.${field}`);
        }
      }
    }
    return misses;
  });

  const requiredDriverMissingLabels = requiredDriverMissing.map((entry) => {
    const [yearStr, key] = entry.split(':');
    const [service, field] = key.split('.');
    const serviceLabel = service === 'vesi'
      ? t('revenue.water.title', 'Vesi')
      : t('revenue.wastewater.title', 'Jätevesi');
    const fieldLabel = field === 'yksikkohinta'
      ? t('revenue.water.unitPrice', 'Yksikköhinta')
      : t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)');
    return `${yearStr} / ${serviceLabel} / ${fieldLabel}`;
  });

  const getQuality = (year: number, service: DriverService, field: DriverField) => {
    return (
      preview?.importQualityByYear?.[year]?.fields?.[`${service}.${field}`]
      ?? preview?.importQuality?.fields?.[`${service}.${field}`]
    );
  };
  const qualityLabel = (status: 'explicit' | 'derived' | 'missing' | undefined) => {
    if (status === 'explicit') return t('kva.qualityExplicit', 'Extracted');
    if (status === 'derived') return t('kva.qualityDerived', 'Derived');
    return t('kva.qualityMissing', 'Missing');
  };
  const qualitySourceLabel = (status: 'explicit' | 'derived' | 'missing' | undefined, source?: string) => {
    if (status === 'missing') return t('kva.qualityMissingSource', 'Ei löytynyt tiedostosta');
    if (!source || source === 'not found') return '';
    return source;
  };

  // Confirm: create one budget per extracted year (base name + " " + year); no single-year Vuosi selector.
  const handleConfirm = async () => {
    const baseName = (budgetNameRef.current ?? budgetName).trim();
    if (!preview || !baseName || extractedYears.length === 0) return;
    if (requiredDriverMissing.length > 0) {
      setError(`${t('kva.requiredMissingLabel', 'Puuttuu')}: ${requiredDriverMissingLabels.join(', ')}`);
      return;
    }
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

    const buildDriversForYear = (year: number): ImportRevenueDriver[] => ([
      'vesi',
      'jatevesi',
    ] as const).map((service) => {
      const source = editedDriversByYear[year]?.[service] ?? { palvelutyyppi: service };
      return {
        palvelutyyppi: service,
        yksikkohinta: getDriverValue(year, service, 'yksikkohinta'),
        myytyMaara: getDriverValue(year, service, 'myytyMaara'),
        perusmaksu: source.perusmaksu,
        liittymamaara: source.liittymamaara,
        alvProsentti: source.alvProsentti,
        sourceMeta: source.sourceMeta,
      };
    });

    const editedDriversByYearPayload = extractedYears.reduce<Record<number, ImportRevenueDriver[]>>((acc, year) => {
      acc[year] = buildDriversForYear(year);
      return acc;
    }, {});

    try {
      const batchId = crypto.randomUUID();
      let lastBudgetId: string | undefined;
      for (const year of extractedYears) {
        const nimi = extractedYears.length > 1 ? `${baseName} ${year}` : baseName;
        const payload = {
          ...buildPayload(year, nimi),
          importBatchId: batchId,
          importSourceFileName: importFileName || undefined,
          reimportMode,
          revenueDrivers: buildDriversForYear(year),
          editedDriversByYear: editedDriversByYearPayload,
          importQuality: {
            requiredMissing: preview.importQualityByYear?.[year]?.requiredMissing ?? [],
            fields: preview.importQualityByYear?.[year]?.fields ?? preview.importQuality?.fields ?? {},
            errorCodes: (preview.importQualityByYear?.[year]?.requiredMissing ?? []).length > 0
              ? ['REQUIRED_DRIVER_FIELDS_MISSING']
              : [],
          },
        };
        if (payload.subtotalLines.length === 0) continue;
        const result = await confirmKvaImport(payload);
        lastBudgetId = result.budgetId;
      }
      if (!lastBudgetId) {
        setError(t('kva.validationSubtotalLinesRequired'));
        return;
      }
      if (lastBudgetId) {
        setResultBudgetId(lastBudgetId);
        setBudgetName(extractedYears.length > 1 ? `${baseName} ${extractedYears[extractedYears.length - 1]}` : baseName);
        setStep('done');
        onImportComplete({
          budgetId: lastBudgetId,
          ...(extractedYears.length > 1 && { importBatchId: batchId }),
        });
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
      driversDebugByYear: preview.driversDebugByYear,
      importQualityByYear: preview.importQualityByYear,
      subtotalDebug: preview.subtotalDebug,
      warnings: preview.warnings,
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
  };

  // Scope to selected years (when Excel has >3 years user picks 3)
  const scopeSubtotals = editedSubtotals.filter((s) => s.year != null && extractedYears.includes(s.year));
  const byYear = scopeSubtotals.reduce<Record<number, KvaSubtotalLine[]>>((acc, s) => {
    const y = s.year ?? 0;
    if (!acc[y]) acc[y] = [];
    acc[y].push(s);
    return acc;
  }, {});
  const yearsSorted = extractedYears.length > 0 ? extractedYears : Object.keys(byYear).map(Number).filter((y) => !isNaN(y)).sort((a, b) => a - b);
  yearsSorted.forEach((y) => {
    if (byYear[y]) byYear[y]!.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.order ?? 0) - (b.order ?? 0));
  });

  const totalsByYear = scopeSubtotals.reduce<Record<number, number>>((acc, s) => {
    const y = s.year;
    if (y == null) return acc;
    acc[y] = (acc[y] ?? 0) + (typeof s.amount === 'number' ? s.amount : 0);
    return acc;
  }, {});
  const yearsWithTotals = yearsSorted.filter((y) => (totalsByYear[y] ?? 0) !== 0);

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
              data-testid="kva-file-input"
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
                    setBudgetName(v);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Budjetin nimi"
                  className={`kva-input ${nameError ? 'input-error' : ''}`}
                />
                {nameError && <span className="kva-input-error">{nameError}</span>}
              </div>
            </div>

            {/* When Excel has >3 years: show "Hittade år" and let user pick exactly 3 (default 3 latest) */}
            {availableYears.length > 3 && (
              <div className="kva-section">
                <h4 className="kva-section-title">{t('kva.foundYears')}</h4>
                <div className="kva-year-chips">
                  {availableYears.slice().sort((a, b) => a - b).map((y) => {
                    const isSelected = selectedYears.includes(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        className={`kva-year-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedYears.length <= 1) return;
                            setSelectedYears((prev) => prev.filter((yr) => yr !== y).sort((a, b) => a - b));
                          } else {
                            if (selectedYears.length >= 3) {
                              setSelectedYears((prev) => [...prev.filter((_, i) => i > 0), y].sort((a, b) => a - b));
                            } else {
                              setSelectedYears((prev) => [...prev, y].sort((a, b) => a - b));
                            }
                          }
                        }}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
                <p className="kva-year-hint">{t('kva.pickThreeYears')}</p>
              </div>
            )}

            <div className="kva-section">
              <h4 className="kva-section-title">{t('kva.requiredInputsTitle', 'Laskennan pakolliset kentät')}</h4>
              <p className="kva-year-hint">
                {t('kva.requiredInputsHint', 'Vesihinta ja myyty määrä tarvitaan sekä vedelle että jätevedelle.')}
              </p>
              <div className="kva-reimport-mode">
                <label htmlFor="kva-reimport-mode">{t('kva.reimportModeLabel', 'Re-import mode')}</label>
                <select
                  id="kva-reimport-mode"
                  className="kva-select"
                  value={reimportMode}
                  onChange={(e) => setReimportMode(e.target.value as 'replace_imported_scope' | 'replace_all')}
                >
                  <option value="replace_imported_scope">{t('kva.reimportModeScoped', 'Replace imported scope (recommended)')}</option>
                  <option value="replace_all">{t('kva.reimportModeAll', 'Replace all (imported + manual)')}</option>
                </select>
              </div>
              <div className="kva-required-grid">
                {(['vesi', 'jatevesi'] as const).map((service) => {
                  const label = service === 'vesi'
                    ? t('revenue.water.title', 'Vesi')
                    : t('revenue.wastewater.title', 'Jätevesi');
                  return (
                    <div key={service} className="kva-required-card">
                      <h5>{label}</h5>
                      <table className="kva-drivers-table">
                        <thead>
                          <tr>
                            <th>{t('common.year', 'Vuosi')}</th>
                            <th className="num-col">{t('revenue.water.unitPrice', 'Yksikköhinta')} (€/m³)</th>
                            <th className="num-col">{t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedYears.map((year, index) => {
                            const unitPrice = getDriverValue(year, service, 'yksikkohinta');
                            const soldVolume = getDriverValue(year, service, 'myytyMaara');
                            const unitPriceQuality = getQuality(year, service, 'yksikkohinta');
                            const soldVolumeQuality = getQuality(year, service, 'myytyMaara');
                            return (
                              <tr key={`${service}-${year}`}>
                                <td>
                                  <div>{year}</div>
                                  {index === 0 && (
                                    <button
                                      type="button"
                                      className="kva-collapse-toggle"
                                      onClick={() => copyFieldToAllYears(service, 'yksikkohinta', year)}
                                    >
                                      {t('kva.copyToAllYears', 'Kopioi hinnat kaikkiin vuosiin')}
                                    </button>
                                  )}
                                  {index === 0 && (
                                    <button
                                      type="button"
                                      className="kva-collapse-toggle"
                                      onClick={() => copyFieldToAllYears(service, 'myytyMaara', year)}
                                    >
                                      {t('kva.copyVolumeToAllYears', 'Kopioi määrä kaikkiin vuosiin')}
                                    </button>
                                  )}
                                  {index === 0 && (
                                    <button
                                      type="button"
                                      className="kva-collapse-toggle"
                                      onClick={() => resetFieldToExtracted(service, 'yksikkohinta')}
                                    >
                                      {t('kva.resetPriceToExtracted', 'Palauta poimitut hinnat')}
                                    </button>
                                  )}
                                  {index === 0 && (
                                    <button
                                      type="button"
                                      className="kva-collapse-toggle"
                                      onClick={() => resetFieldToExtracted(service, 'myytyMaara')}
                                    >
                                      {t('kva.resetVolumeToExtracted', 'Palauta poimitut määrät')}
                                    </button>
                                  )}
                                </td>
                                <td className="num-col">
                                  <input
                                    type="text"
                                    value={formatDecimal(unitPrice)}
                                    className={unitPrice > 0 ? 'kva-input small' : 'kva-input small input-error'}
                                    onChange={(e) => upsertDriverValue(year, service, 'yksikkohinta', e.target.value)}
                                  />
                                  <div className={`kva-quality-item kva-quality-${unitPriceQuality?.status ?? 'missing'}`}>
                                    {qualityLabel(unitPriceQuality?.status)}
                                    {qualitySourceLabel(unitPriceQuality?.status, unitPriceQuality?.source)
                                      ? ` · ${qualitySourceLabel(unitPriceQuality?.status, unitPriceQuality?.source)}`
                                      : ''}
                                  </div>
                                </td>
                                <td className="num-col">
                                  <input
                                    type="text"
                                    value={formatDecimal(soldVolume)}
                                    className={soldVolume > 0 ? 'kva-input small' : 'kva-input small input-error'}
                                    onChange={(e) => upsertDriverValue(year, service, 'myytyMaara', e.target.value)}
                                  />
                                  <div className={`kva-quality-item kva-quality-${soldVolumeQuality?.status ?? 'missing'}`}>
                                    {qualityLabel(soldVolumeQuality?.status)}
                                    {qualitySourceLabel(soldVolumeQuality?.status, soldVolumeQuality?.source)
                                      ? ` · ${qualitySourceLabel(soldVolumeQuality?.status, soldVolumeQuality?.source)}`
                                      : ''}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              {requiredDriverMissing.length > 0 && (
                <div className="kva-input-error">
                  {t('kva.requiredMissingLabel', 'Puuttuu')}: {requiredDriverMissingLabels.join(', ')}
                </div>
              )}
            </div>

            {/* Section A: 3 year cards, 4 bucket rows per card, expand per bucket (not whole year) */}
            <div className="kva-section kva-year-sections">
              <h4 className="kva-section-title">Talousarvio (välisummat per vuosi)</h4>
              {yearsSorted.length === 0 ? (
                <p className="kva-empty">Välisummarivejä ei löydetty tiedostosta.</p>
              ) : (
                yearsSorted.map((year) => {
                  const lines = byYear[year] ?? [];
                  const bucketKeys = ['income', 'cost', 'depreciation', 'investment'] as const;
                  const bucketTotals: Record<string, number> = { income: 0, cost: 0, depreciation: 0, investment: 0 };
                  const bucketLines: Record<string, KvaSubtotalLine[]> = { income: [], cost: [], depreciation: [], investment: [] };
                  lines.forEach((s) => {
                    let key: string = s.type;
                    if (s.type === 'financial') key = 'income';
                    else if (s.type === 'income') key = 'income';
                    else if (s.type === 'cost') key = 'cost';
                    else if (s.type === 'depreciation') key = 'depreciation';
                    else if (s.type === 'investment') key = 'investment';
                    else return;
                    bucketTotals[key] = (bucketTotals[key] ?? 0) + (typeof s.amount === 'number' ? s.amount : 0);
                    bucketLines[key].push(s);
                  });
                  const yearTulos = (bucketTotals.income ?? 0) - (bucketTotals.cost ?? 0) - (bucketTotals.depreciation ?? 0) - (bucketTotals.investment ?? 0);
                  const tulosPositive = yearTulos > 0;
                  return (
                    <div key={year} className="kva-year-card" data-testid={`kva-year-card-${year}`}>
                      <h5 className="kva-year-card-title">
                        Vuosi {year}
                        <span className={`kva-year-total-badge kva-year-total-badge--${tulosPositive ? 'positive' : 'negative'}`}>
                          {TYPE_DISPLAY.result} {formatCurrency(yearTulos)}
                        </span>
                      </h5>
                      <div className="kva-bucket-rows">
                        {bucketKeys.map((bucketKey) => {
                          const key = `${year}:${bucketKey}`;
                          const isExpanded = expandedBuckets.has(key);
                          const total = bucketTotals[bucketKey] ?? 0;
                          const detailLines = bucketLines[bucketKey] ?? [];
                          return (
                            <div key={key} className={`kva-bucket-row kva-bucket-${bucketKey}`}>
                              <div
                                className="kva-bucket-row-header"
                                role="button"
                                tabIndex={0}
                                onClick={() => setExpandedBuckets((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                                onKeyDown={(e) => e.key === 'Enter' && setExpandedBuckets((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                              >
                                <span className="kva-bucket-expand">{isExpanded ? '▼' : '▶'}</span>
                                <span className="kva-bucket-label">{TYPE_DISPLAY[bucketKey]}</span>
                                <span className="kva-bucket-total">{formatCurrency(total)}</span>
                              </div>
                              {isExpanded && detailLines.length > 0 && (
                                <div className="kva-bucket-details">
                                  {detailLines.map((s, i) => {
                                    const idx = editedSubtotals.findIndex((x) => x === s);
                                    return (
                                      <div key={`${key}-${i}`} className="kva-detail-row">
                                        <span className="kva-category-name">{s.categoryName}</span>
                                        <span className="num-col kva-underrow-amount">
                                          {s.type === 'result' ? formatCurrency(s.amount) : (
                                            <>
                                              <input
                                                type="text"
                                                className="kva-amount-input"
                                                value={typeof s.amount === 'number' ? formatDecimal(s.amount) : String(s.amount).replace('.', ',')}
                                                onChange={(e) => idx >= 0 && updateSubtotalAmount(idx, e.target.value)}
                                              />
                                              <span className="kva-amount-suffix">€</span>
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Diagnostiikka: collapsible debug/warnings (no yellow box in normal flow) */}
            <div className="kva-section">
              <details className="kva-diagnostiikka">
                <summary>Diagnostiikka</summary>
                <div className="kva-diagnostiikka-inner">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={copyDiagnostics} title="Kopioi diagnostiikka">
                    📋 Kopioi
                  </button>
                  {preview.warnings.filter((w) => !w.includes('[KVA_DEBUG]') && !/revenue\s*driver|tuloajuri|template\s*missing|blad1/i.test(w)).length > 0 ? (
                    <div className="kva-warnings">
                      {preview.warnings
                        .filter((w) => !w.includes('[KVA_DEBUG]') && !/revenue\s*driver|tuloajuri|template\s*missing|blad1/i.test(w))
                        .map((w, i) => (
                          <div key={i} className="kva-warning-item">⚠ {w}</div>
                        ))}
                    </div>
                  ) : (
                    <p className="kva-diagnostiikka-empty">Ei varoituksia.</p>
                  )}
                </div>
              </details>
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
              </div>
              <button
                className="btn btn-primary kva-confirm-btn"
                data-testid="kva-confirm-btn"
                onClick={handleConfirm}
                disabled={confirming || !budgetName.trim() || extractedYears.length === 0 || requiredDriverMissing.length > 0}
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
