import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  previewKvaImport,
  confirmKvaImportBatch,
  fetchVeetiDrivers,
  type KvaConfirmBody,
  type KvaPreviewResult,
  type KvaSubtotalLine,
  type ImportRevenueDriver,
  type VeetiDriversResult,
} from '../api';
import { formatCurrency, formatDecimal } from '../utils/format';

export interface KvaImportCompleteResult {
  budgetId: string;
  importBatchId?: string;
}

type DriverService = 'vesi' | 'jatevesi';
type DriverField = 'yksikkohinta' | 'myytyMaara';
type DriversByYearState = Record<number, Record<DriverService, ImportRevenueDriver>>;
type ConfirmRevenueDriver = NonNullable<KvaConfirmBody['revenueDrivers']>[number];

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

export function buildConsecutiveTriples(yearChoices: number[]): number[][] {
  const sortedChoices = Array.from(new Set(yearChoices)).sort((a, b) => a - b);
  const triples: number[][] = [];
  for (let i = 0; i <= sortedChoices.length - 3; i += 1) {
    const a = sortedChoices[i]!;
    const b = sortedChoices[i + 1]!;
    const c = sortedChoices[i + 2]!;
    if (b === a + 1 && c === b + 1) {
      triples.push([a, b, c]);
    }
  }
  return triples;
}

function isConsecutiveThreeYears(years: number[]): boolean {
  if (years.length !== 3) return false;
  const sorted = years.slice().sort((a, b) => a - b);
  return sorted[1] === sorted[0]! + 1 && sorted[2] === sorted[1]! + 1;
}

function pickTripletForClickedYear(
  clickedYear: number,
  triplets: number[][],
  currentYears: number[],
): number[] | null {
  const candidates = triplets.filter((triplet) => triplet.includes(clickedYear));
  if (candidates.length === 0) return null;
  const currentSet = new Set(currentYears);
  let best = candidates[0]!;
  let bestOverlap = -1;
  for (const candidate of candidates) {
    const overlap = candidate.filter((year) => currentSet.has(year)).length;
    if (overlap > bestOverlap) {
      best = candidate;
      bestOverlap = overlap;
    }
  }
  return best.slice().sort((a, b) => a - b);
}

export function pickDefaultSelectedYears(
  yearChoices: number[],
  preferredYears: number[] | undefined,
): number[] {
  const sortedChoices = yearChoices.slice().sort((a, b) => a - b);
  if (sortedChoices.length <= 3) return sortedChoices;
  const triples = buildConsecutiveTriples(sortedChoices);
  if (triples.length === 0) return sortedChoices.slice(0, 3);

  const preferred = (preferredYears ?? [])
    .filter((year) => sortedChoices.includes(year))
    .sort((a, b) => a - b);

  if (preferred.length > 0) {
    const preferredSet = new Set(preferred);
    let best = triples[0]!;
    let bestOverlap = -1;
    for (const triplet of triples) {
      const overlap = triplet.filter((year) => preferredSet.has(year)).length;
      if (overlap > bestOverlap) {
        best = triplet;
        bestOverlap = overlap;
      }
    }
    return best.slice().sort((a, b) => a - b);
  }
  return triples[0]!.slice().sort((a, b) => a - b);
}

function driverPathLabel(
  path: string,
  t: any,
): string {
  const [service, field] = path.split('.');
  const serviceLabel = service === 'vesi'
    ? String(t('revenue.water.title', 'Vesi'))
    : String(t('revenue.wastewater.title', 'Jätevesi'));
  const fieldLabel = field === 'yksikkohinta'
    ? String(t('revenue.water.unitPrice', 'Yksikköhinta'))
    : String(t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)'));
  return `${serviceLabel} / ${fieldLabel}`;
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
  const [selectedYears, setSelectedYears] = useState<number[]>([]); // when Excel has >3 years, user picks one consecutive 3-year block
  const [reimportMode, setReimportMode] = useState<'replace_imported_scope' | 'replace_all'>('replace_imported_scope');
  const [veetiOrgId, setVeetiOrgId] = useState('');
  const [veetiLoading, setVeetiLoading] = useState(false);
  const [veetiError, setVeetiError] = useState<string | null>(null);
  const [veetiStatus, setVeetiStatus] = useState<string | null>(null);
  const [showRequiredValidation, setShowRequiredValidation] = useState(false);

  // Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setLoading(true);
    setImportFileName(f.name);
    setVeetiError(null);
    setVeetiStatus(null);
    setShowRequiredValidation(false);

    try {
      const result = await previewKvaImport(f);
      setPreview(result);
      const subtotalYears = Array.from(
        new Set(
          (result.subtotalLines ?? [])
            .map((line) => line.year)
            .filter((year): year is number => typeof year === 'number' && Number.isFinite(year)),
        ),
      ).sort((a, b) => a - b);
      const allYears = result.availableYears ?? result.subtotalDebug?.selectedHistoricalYears ?? [];
      const yearChoices = subtotalYears.length > 0 ? subtotalYears : allYears;
      const selected = pickDefaultSelectedYears(
        yearChoices,
        result.subtotalDebug?.selectedHistoricalYears ?? allYears,
      );
      setSelectedYears(selected);
      setBudgetName(yearChoices.length > 0 ? `KVA ${yearChoices[yearChoices.length - 1]}` : 'KVA Import');
      setEditedSubtotals(result.subtotalLines ?? []);
      setEditedDriversByYear(buildDriverStateFromPreview(result, selected.length > 0 ? selected : yearChoices));
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
  const subtotalYears = Array.from(
    new Set(
      editedSubtotals
        .map((line) => line.year)
        .filter((year): year is number => typeof year === 'number' && Number.isFinite(year)),
    ),
  ).sort((a, b) => a - b);
  const yearChoices = subtotalYears.length > 0 ? subtotalYears : availableYears;
  const consecutiveTriples = buildConsecutiveTriples(yearChoices);
  const hasConsecutiveTriples = consecutiveTriples.length > 0;
  const extractedYears = selectedYears.length > 0 ? selectedYears.slice().sort((a, b) => a - b) : yearChoices.slice(0, 3);
  const selectedYearsAreConsecutive = isConsecutiveThreeYears(extractedYears);
  const requiresExactThreeYearSelection = yearChoices.length > 3;
  const invalidYearSelection = requiresExactThreeYearSelection
    && (!hasConsecutiveTriples || extractedYears.length !== 3 || !selectedYearsAreConsecutive);

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

  useEffect(() => {
    if (!requiresExactThreeYearSelection || !hasConsecutiveTriples) return;
    if (selectedYears.length === 3 && isConsecutiveThreeYears(selectedYears)) return;
    const next = pickDefaultSelectedYears(yearChoices, selectedYears);
    setSelectedYears(next);
  }, [
    requiresExactThreeYearSelection,
    hasConsecutiveTriples,
    yearChoices.join(','),
    selectedYears.join(','),
  ]);

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
          ...(prev[year]?.vesi ?? {}),
          palvelutyyppi: 'vesi',
        },
        jatevesi: {
          ...(prev[year]?.jatevesi ?? {}),
          palvelutyyppi: 'jatevesi',
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
          vesi: { ...(next[year]?.vesi ?? {}), palvelutyyppi: 'vesi' },
          jatevesi: { ...(next[year]?.jatevesi ?? {}), palvelutyyppi: 'jatevesi' },
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
          vesi: { ...(next[year]?.vesi ?? {}), palvelutyyppi: 'vesi' },
          jatevesi: { ...(next[year]?.jatevesi ?? {}), palvelutyyppi: 'jatevesi' },
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
  const requiredDriverTotalCount = extractedYears.length * 4;
  const requiredDriverCompleteCount = Math.max(0, requiredDriverTotalCount - requiredDriverMissing.length);
  const requiredDriverProgress = requiredDriverTotalCount > 0
    ? Math.round((requiredDriverCompleteCount / requiredDriverTotalCount) * 100)
    : 0;
  const referenceYear = extractedYears[0];
  const missingLabelPreview = requiredDriverMissingLabels.slice(0, 6);
  const missingLabelOverflow = Math.max(0, requiredDriverMissingLabels.length - missingLabelPreview.length);

  useEffect(() => {
    if (showRequiredValidation && requiredDriverMissing.length === 0) {
      setShowRequiredValidation(false);
    }
  }, [requiredDriverMissing.length, showRequiredValidation]);

  const getQuality = (year: number, service: DriverService, field: DriverField) => {
    return (
      preview?.importQualityByYear?.[year]?.fields?.[`${service}.${field}`]
      ?? preview?.importQuality?.fields?.[`${service}.${field}`]
    );
  };
  const resolveDisplayQuality = (
    status: 'explicit' | 'derived' | 'missing' | undefined,
    value: number,
  ): 'explicit' | 'derived' | 'missing' | 'manual' => {
    if (value > 0 && (status === 'missing' || status == null)) return 'manual';
    return status ?? 'explicit';
  };
  const qualityLabel = (status: 'explicit' | 'derived' | 'missing' | 'manual' | undefined) => {
    if (status === 'explicit') return t('kva.qualityExplicit', 'Extracted');
    if (status === 'derived') return t('kva.qualityDerived', 'Derived');
    if (status === 'manual') return t('kva.qualityManual', 'Syötetty käsin');
    return t('kva.qualityPending', 'Täydennä käsin');
  };
  const qualitySourceLabel = (status: 'explicit' | 'derived' | 'missing' | 'manual' | undefined, source?: string) => {
    if (status === 'missing' || status === 'manual') return '';
    if (!source || source === 'not found') return '';
    return source;
  };

  const handleVeetiAutofill = async () => {
    const parsedOrgId = Number.parseInt(veetiOrgId.trim(), 10);
    if (!Number.isInteger(parsedOrgId) || parsedOrgId <= 0) {
      setVeetiError(t('kva.veetiInvalidOrgId', 'Anna kelvollinen VEETI-organisaation numero.'));
      setVeetiStatus(null);
      return;
    }
    if (extractedYears.length === 0) {
      setVeetiError(t('kva.veetiNoYears', 'Valitse ensin vuodet ennen VEETI-tuontia.'));
      setVeetiStatus(null);
      return;
    }

    setVeetiLoading(true);
    setVeetiError(null);
    setVeetiStatus(null);
    try {
      const result: VeetiDriversResult = await fetchVeetiDrivers({
        orgId: parsedOrgId,
        years: extractedYears,
      });

      setEditedDriversByYear((prev) => {
        const next: DriversByYearState = { ...prev };
        for (const year of extractedYears) {
          const drivers = result.driversByYear[year] ?? [];
          const water = drivers.find((driver) => driver.palvelutyyppi === 'vesi');
          const wastewater = drivers.find((driver) => driver.palvelutyyppi === 'jatevesi');
          next[year] = {
            vesi: {
              ...(next[year]?.vesi ?? { palvelutyyppi: 'vesi' }),
              palvelutyyppi: 'vesi',
              ...(typeof water?.yksikkohinta === 'number' ? { yksikkohinta: water.yksikkohinta } : {}),
              ...(typeof water?.myytyMaara === 'number' ? { myytyMaara: water.myytyMaara } : {}),
              ...(water?.sourceMeta ? { sourceMeta: water.sourceMeta } : {}),
            },
            jatevesi: {
              ...(next[year]?.jatevesi ?? { palvelutyyppi: 'jatevesi' }),
              palvelutyyppi: 'jatevesi',
              ...(typeof wastewater?.yksikkohinta === 'number' ? { yksikkohinta: wastewater.yksikkohinta } : {}),
              ...(typeof wastewater?.myytyMaara === 'number' ? { myytyMaara: wastewater.myytyMaara } : {}),
              ...(wastewater?.sourceMeta ? { sourceMeta: wastewater.sourceMeta } : {}),
            },
          };
        }
        return next;
      });

      const fetchedAt = new Date(result.fetchedAt);
      const fetchedAtLabel = Number.isNaN(fetchedAt.getTime())
        ? result.fetchedAt
        : fetchedAt.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
      setVeetiStatus(
        t('kva.veetiFetchedStatus', {
          org: result.org.name ?? `#${result.org.id}`,
          time: fetchedAtLabel,
        }),
      );

      const missingLabels = extractedYears.flatMap((year) => {
        const missing = result.missingByYear[year] ?? [];
        return missing.map((path) => `${year} / ${driverPathLabel(path, t)}`);
      });
      if (missingLabels.length > 0) {
        setVeetiError(
          `${t('kva.veetiPartialData', 'VEETIstä puuttui osa kentistä')}: ${missingLabels.join(', ')}`,
        );
      }
    } catch (err: any) {
      setVeetiError(err?.message ?? t('kva.veetiFetchFailed', 'VEETI-haku epäonnistui.'));
      setVeetiStatus(null);
    } finally {
      setVeetiLoading(false);
    }
  };

  // Confirm: create one budget per extracted year (base name + " " + year); no single-year Vuosi selector.
  const handleConfirm = async () => {
    const baseName = (budgetNameRef.current ?? budgetName).trim();
    if (!preview || !baseName || extractedYears.length === 0) return;
    if (invalidYearSelection) {
      setError(
        hasConsecutiveTriples
          ? t('kva.pickThreeYears', 'Valitse 3 vuotta (vanhimmasta uusimpaan).')
          : t('kva.noConsecutiveYears', 'Tiedostosta ei löydy kolmea peräkkäistä vuotta.'),
      );
      return;
    }
    if (requiredDriverMissing.length > 0) {
      setShowRequiredValidation(true);
      setError(
        t(
          'kva.requiredInputsHint',
          'Vesihinta ja myyty määrä tarvitaan sekä vedelle että jätevedelle.',
        ),
      );
      return;
    }
    const yearsWithoutSubtotals = extractedYears.filter(
      (year) => !editedSubtotals.some((line) => line.year === year),
    );
    if (yearsWithoutSubtotals.length > 0) {
      setError(
        `${t('kva.validationSubtotalLinesRequired', 'Välsummat puuttuvat valituilta vuosilta')}: ${yearsWithoutSubtotals.join(', ')}`,
      );
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

    const buildDriversForYear = (year: number): ConfirmRevenueDriver[] => ([
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
      const yearsPayload = extractedYears.map((year) => {
        const nimi = extractedYears.length > 1 ? `${baseName} ${year}` : baseName;
        return {
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
      });

      const result = await confirmKvaImportBatch({
        years: yearsPayload,
        extractedYears,
        importBatchId: batchId,
        importSourceFileName: importFileName || undefined,
        reimportMode,
      });
      const budgetIds = Array.isArray(result.budgetIds) ? result.budgetIds : [];
      const lastBudgetId = budgetIds[budgetIds.length - 1];
      if (!lastBudgetId) {
        setError(t('kva.validationSubtotalLinesRequired'));
        return;
      }
      setResultBudgetId(lastBudgetId);
      setBudgetName(extractedYears.length > 1 ? `${baseName} ${extractedYears[extractedYears.length - 1]}` : baseName);
      setStep('done');
      onImportComplete({
        budgetId: lastBudgetId,
        ...(extractedYears.length > 1 && { importBatchId: batchId }),
      });
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
            {requiresExactThreeYearSelection && (
              <div className="kva-section">
                <h4 className="kva-section-title">{t('kva.foundYears')}</h4>
                <div className="kva-year-chips">
                  {yearChoices.slice().sort((a, b) => a - b).map((y) => {
                    const isSelected = selectedYears.includes(y);
                    const isSelectable = hasConsecutiveTriples && consecutiveTriples.some((triplet) => triplet.includes(y));
                    return (
                      <button
                        key={y}
                        type="button"
                        className={`kva-year-chip ${isSelected ? 'selected' : ''} ${isSelectable ? '' : 'disabled'}`}
                        disabled={!isSelectable}
                        onClick={() => {
                          if (!isSelectable) return;
                          const next = pickTripletForClickedYear(y, consecutiveTriples, selectedYears);
                          if (!next) return;
                          setSelectedYears(next);
                        }}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
                <p className="kva-year-hint">{t('kva.pickThreeYears', 'Valitse 3 vuotta (vanhimmasta uusimpaan).')}</p>
                {invalidYearSelection && (
                  <p className="kva-input-error">
                    {hasConsecutiveTriples
                      ? t('kva.pickThreeYears', 'Valitse 3 vuotta (vanhimmasta uusimpaan).')
                      : t('kva.noConsecutiveYears', 'Tiedostosta ei löydy kolmea peräkkäistä vuotta.')}
                  </p>
                )}
              </div>
            )}

            <div className="kva-section">
              <h4 className="kva-section-title">{t('kva.requiredInputsTitle', 'Laskennan pakolliset kentät')}</h4>
              <p className="kva-year-hint">
                {t('kva.requiredInputsHint', 'Vesihinta ja myyty määrä tarvitaan sekä vedelle että jätevedelle.')}
              </p>
              <div className="kva-required-header">
                <div className="kva-required-progress-meta">
                  <span>
                    {requiredDriverCompleteCount}/{requiredDriverTotalCount}{' '}
                    {t('kva.progressFilled', 'kenttää täytetty')}
                  </span>
                  <strong>{requiredDriverProgress}%</strong>
                </div>
                <div className="kva-required-progress-track" aria-hidden="true">
                  <div
                    className="kva-required-progress-value"
                    style={{ width: `${requiredDriverProgress}%` }}
                  />
                </div>
              </div>
              <div className="kva-veeti-panel">
                <div className="kva-veeti-row">
                  <div className="kva-control-group kva-control-group--inline">
                    <label htmlFor="kva-veeti-org-id">{t('kva.veetiOrgIdLabel', 'VEETI organisaatio ID')}</label>
                    <input
                      id="kva-veeti-org-id"
                      data-testid="kva-veeti-org-id-input"
                      type="text"
                      inputMode="numeric"
                      value={veetiOrgId}
                      onChange={(e) => setVeetiOrgId(e.target.value.replace(/[^\d]/g, ''))}
                      className="kva-input"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="kva-veeti-fetch-btn"
                    onClick={handleVeetiAutofill}
                    disabled={veetiLoading || extractedYears.length === 0}
                  >
                    {veetiLoading
                      ? t('kva.veetiLoading', 'Haetaan VEETIstä...')
                      : t('kva.veetiFetchCta', 'Hae VEETIstä valituille vuosille')}
                  </button>
                </div>
                <p className="kva-year-hint">
                  {t(
                    'kva.veetiHint',
                    'Täyttää vesi/jätevesi yksikköhinnan ja myydyn määrän valituille vuosille. Voit silti muokata arvoja käsin.',
                  )}
                </p>
                {veetiStatus && (
                  <p className="kva-inline-status kva-inline-status-success" data-testid="kva-veeti-status">{veetiStatus}</p>
                )}
                {veetiError && (
                  <p className="kva-inline-status kva-inline-status-warning" data-testid="kva-veeti-error">{veetiError}</p>
                )}
              </div>
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
                      <div className="kva-required-card-header">
                        <h5>{label}</h5>
                        {referenceYear != null && (
                          <div className="kva-required-actions">
                            <button
                              type="button"
                              className="kva-collapse-toggle"
                              onClick={() => copyFieldToAllYears(service, 'yksikkohinta', referenceYear)}
                            >
                              {t('kva.copyToAllYears', 'Kopioi hinnat kaikkiin vuosiin')}
                            </button>
                            <button
                              type="button"
                              className="kva-collapse-toggle"
                              onClick={() => copyFieldToAllYears(service, 'myytyMaara', referenceYear)}
                            >
                              {t('kva.copyVolumeToAllYears', 'Kopioi määrä kaikkiin vuosiin')}
                            </button>
                            <button
                              type="button"
                              className="kva-collapse-toggle"
                              onClick={() => resetFieldToExtracted(service, 'yksikkohinta')}
                            >
                              {t('kva.resetPriceToExtracted', 'Palauta poimitut hinnat')}
                            </button>
                            <button
                              type="button"
                              className="kva-collapse-toggle"
                              onClick={() => resetFieldToExtracted(service, 'myytyMaara')}
                            >
                              {t('kva.resetVolumeToExtracted', 'Palauta poimitut määrät')}
                            </button>
                          </div>
                        )}
                      </div>
                      <table className="kva-drivers-table">
                        <thead>
                          <tr>
                            <th>{t('common.year', 'Vuosi')}</th>
                            <th className="num-col">{t('revenue.water.unitPrice', 'Yksikköhinta')} (€/m³)</th>
                            <th className="num-col">{t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedYears.map((year) => {
                            const unitPrice = getDriverValue(year, service, 'yksikkohinta');
                            const soldVolume = getDriverValue(year, service, 'myytyMaara');
                            const unitPriceMissing = unitPrice <= 0;
                            const soldVolumeMissing = soldVolume <= 0;
                            const unitPriceQuality = getQuality(year, service, 'yksikkohinta');
                            const soldVolumeQuality = getQuality(year, service, 'myytyMaara');
                            const unitPriceDisplayState = resolveDisplayQuality(unitPriceQuality?.status, unitPrice);
                            const soldVolumeDisplayState = resolveDisplayQuality(soldVolumeQuality?.status, soldVolume);
                            return (
                              <tr key={`${service}-${year}`}>
                                <td className="kva-driver-year">{year}</td>
                                <td className="num-col">
                                  <div className="kva-driver-input-wrap">
                                    <input
                                      type="text"
                                      value={formatDecimal(unitPrice)}
                                      className={
                                        (showRequiredValidation && unitPriceMissing)
                                          ? 'kva-input small input-error'
                                          : 'kva-input small'
                                      }
                                      onChange={(e) => upsertDriverValue(year, service, 'yksikkohinta', e.target.value)}
                                    />
                                    <div
                                      className={`kva-driver-state ${
                                        unitPriceMissing
                                          ? (showRequiredValidation ? 'kva-driver-state-missing' : 'kva-driver-state-pending')
                                          : `kva-driver-state-${unitPriceDisplayState}`
                                      }`}
                                    >
                                      {unitPriceMissing
                                        ? (showRequiredValidation
                                          ? t('kva.requiredMissingLabel', 'Puuttuu')
                                          : t('kva.qualityPending', 'Täydennä käsin'))
                                        : qualityLabel(unitPriceDisplayState)}
                                      {qualitySourceLabel(unitPriceDisplayState, unitPriceQuality?.source)
                                        ? ` · ${qualitySourceLabel(unitPriceDisplayState, unitPriceQuality?.source)}`
                                        : ''}
                                    </div>
                                  </div>
                                </td>
                                <td className="num-col">
                                  <div className="kva-driver-input-wrap">
                                    <input
                                      type="text"
                                      value={formatDecimal(soldVolume)}
                                      className={
                                        (showRequiredValidation && soldVolumeMissing)
                                          ? 'kva-input small input-error'
                                          : 'kva-input small'
                                      }
                                      onChange={(e) => upsertDriverValue(year, service, 'myytyMaara', e.target.value)}
                                    />
                                    <div
                                      className={`kva-driver-state ${
                                        soldVolumeMissing
                                          ? (showRequiredValidation ? 'kva-driver-state-missing' : 'kva-driver-state-pending')
                                          : `kva-driver-state-${soldVolumeDisplayState}`
                                      }`}
                                    >
                                      {soldVolumeMissing
                                        ? (showRequiredValidation
                                          ? t('kva.requiredMissingLabel', 'Puuttuu')
                                          : t('kva.qualityPending', 'Täydennä käsin'))
                                        : qualityLabel(soldVolumeDisplayState)}
                                      {qualitySourceLabel(soldVolumeDisplayState, soldVolumeQuality?.source)
                                        ? ` · ${qualitySourceLabel(soldVolumeDisplayState, soldVolumeQuality?.source)}`
                                        : ''}
                                    </div>
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
                <div className={`kva-missing-summary ${showRequiredValidation ? 'is-active' : ''}`}>
                  <strong>
                    {t('kva.requiredMissingLabel', 'Puuttuu')} ({requiredDriverMissing.length})
                  </strong>
                  <div className="kva-missing-summary-list">
                    {missingLabelPreview.map((label) => (
                      <span key={label} className="kva-missing-chip">{label}</span>
                    ))}
                    {missingLabelOverflow > 0 && (
                      <span className="kva-missing-chip">+{missingLabelOverflow}</span>
                    )}
                  </div>
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
                  onClick={() => {
                    setStep('upload');
                    setPreview(null);
                    setVeetiError(null);
                    setVeetiStatus(null);
                  }}
                  disabled={confirming}
                >
                  ← Valitse toinen tiedosto
                </button>
              </div>
              <button
                className="btn btn-primary kva-confirm-btn"
                data-testid="kva-confirm-btn"
                onClick={handleConfirm}
                disabled={confirming || !budgetName.trim() || extractedYears.length === 0 || invalidYearSelection || requiredDriverMissing.length > 0}
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
