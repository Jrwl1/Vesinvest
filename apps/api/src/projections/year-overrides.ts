export type YearOverrideLockMode = 'price' | 'percent';

export interface YearCategoryGrowthPct {
  personnel?: number;
  energy?: number;
  opexOther?: number;
  otherIncome?: number;
  investments?: number;
}

export interface YearLineOverride {
  mode: 'percent' | 'absolute';
  value: number;
}

export interface ProjectionYearOverride {
  waterPriceEurM3?: number;
  waterPriceGrowthPct?: number;
  lockMode?: YearOverrideLockMode;
  investmentEur?: number;
  categoryGrowthPct?: YearCategoryGrowthPct;
  lineOverrides?: Record<string, YearLineOverride>;
}

export type ProjectionYearOverrides = Record<number, ProjectionYearOverride>;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toYear = (value: unknown): number | undefined => {
  const n = toFiniteNumber(value);
  if (typeof n !== 'number') return undefined;
  const rounded = Math.round(n);
  return Number.isFinite(rounded) ? rounded : undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeProjectionYearOverrides(
  raw: unknown,
): ProjectionYearOverrides | undefined {
  if (!isObject(raw)) return undefined;
  const out: ProjectionYearOverrides = {};

  for (const [yearKey, payload] of Object.entries(raw)) {
    const year = toYear(yearKey);
    if (!year || !isObject(payload)) continue;

    const payloadRecord = payload as Record<string, unknown>;
    const next = { ...payloadRecord } as ProjectionYearOverride;
    const waterPriceEurM3 = toFiniteNumber(payloadRecord.waterPriceEurM3);
    const waterPriceGrowthPct = toFiniteNumber(
      payloadRecord.waterPriceGrowthPct,
    );
    const investmentEur = toFiniteNumber(payloadRecord.investmentEur);

    if (typeof waterPriceEurM3 === 'number')
      next.waterPriceEurM3 = waterPriceEurM3;
    else delete next.waterPriceEurM3;
    if (typeof waterPriceGrowthPct === 'number')
      next.waterPriceGrowthPct = waterPriceGrowthPct;
    else delete next.waterPriceGrowthPct;
    if (typeof investmentEur === 'number') next.investmentEur = investmentEur;
    else delete next.investmentEur;

    if (
      payloadRecord.lockMode === 'price' ||
      payloadRecord.lockMode === 'percent'
    ) {
      next.lockMode = payloadRecord.lockMode;
    } else {
      delete next.lockMode;
    }

    if (isObject(payloadRecord.categoryGrowthPct)) {
      const category = {
        ...(payloadRecord.categoryGrowthPct as Record<string, unknown>),
      } as YearCategoryGrowthPct;
      const personnel = toFiniteNumber(category.personnel);
      const energy = toFiniteNumber(category.energy);
      const opexOther = toFiniteNumber(category.opexOther);
      const otherIncome = toFiniteNumber(category.otherIncome);
      const investments = toFiniteNumber(category.investments);
      if (typeof personnel === 'number') category.personnel = personnel;
      else delete category.personnel;
      if (typeof energy === 'number') category.energy = energy;
      else delete category.energy;
      if (typeof opexOther === 'number') category.opexOther = opexOther;
      else delete category.opexOther;
      if (typeof otherIncome === 'number') category.otherIncome = otherIncome;
      else delete category.otherIncome;
      if (typeof investments === 'number') category.investments = investments;
      else delete category.investments;
      if (Object.keys(category).length > 0) next.categoryGrowthPct = category;
      else delete next.categoryGrowthPct;
    } else {
      delete next.categoryGrowthPct;
    }

    if (isObject(payloadRecord.lineOverrides)) {
      const lineOverrides = {
        ...(payloadRecord.lineOverrides as Record<string, unknown>),
      };
      for (const [lineKey, lineRaw] of Object.entries(lineOverrides)) {
        if (!isObject(lineRaw)) continue;
        if (lineRaw.mode !== 'percent' && lineRaw.mode !== 'absolute') continue;
        const value = toFiniteNumber(lineRaw.value);
        if (typeof value !== 'number') continue;
        lineOverrides[lineKey] = { mode: lineRaw.mode, value };
      }
      if (Object.keys(lineOverrides).length > 0) {
        next.lineOverrides = lineOverrides as Record<string, YearLineOverride>;
      } else {
        delete next.lineOverrides;
      }
    } else {
      delete next.lineOverrides;
    }

    if (Object.keys(next).length > 0) {
      out[year] = next;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function mergeUserInvestmentsIntoYearOverrides(
  yearOverrides: ProjectionYearOverrides | undefined,
  userInvestments:
    | Array<{ year: number; amount: number; [key: string]: unknown }>
    | undefined,
): ProjectionYearOverrides | undefined {
  if (!yearOverrides && (!userInvestments || userInvestments.length === 0))
    return undefined;
  const out: ProjectionYearOverrides = { ...(yearOverrides ?? {}) };
  const yearsWithExplicitInvestmentOverride = new Set(
    Object.entries(yearOverrides ?? {})
      .filter(([, payload]) => typeof payload?.investmentEur === 'number')
      .map(([year]) => Math.round(Number(year)))
      .filter((year) => Number.isFinite(year)),
  );
  for (const item of userInvestments ?? []) {
    if (!Number.isFinite(item.year) || !Number.isFinite(item.amount)) continue;
    const year = Math.round(item.year);
    out[year] = {
      ...(out[year] ?? {}),
      investmentEur:
        yearsWithExplicitInvestmentOverride.has(year)
          ? out[year]?.investmentEur
          : item.amount + (out[year]?.investmentEur ?? 0),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
