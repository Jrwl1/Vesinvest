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

export function normalizeProjectionYearOverrides(raw: unknown): ProjectionYearOverrides | undefined {
  if (!isObject(raw)) return undefined;
  const out: ProjectionYearOverrides = {};

  for (const [yearKey, payload] of Object.entries(raw)) {
    const year = toYear(yearKey);
    if (!year || !isObject(payload)) continue;

    const next: ProjectionYearOverride = {};
    const waterPriceEurM3 = toFiniteNumber(payload.waterPriceEurM3);
    const waterPriceGrowthPct = toFiniteNumber(payload.waterPriceGrowthPct);
    const investmentEur = toFiniteNumber(payload.investmentEur);

    if (typeof waterPriceEurM3 === 'number') next.waterPriceEurM3 = waterPriceEurM3;
    if (typeof waterPriceGrowthPct === 'number') next.waterPriceGrowthPct = waterPriceGrowthPct;
    if (typeof investmentEur === 'number') next.investmentEur = investmentEur;
    if (payload.lockMode === 'price' || payload.lockMode === 'percent') {
      next.lockMode = payload.lockMode;
    }

    if (isObject(payload.categoryGrowthPct)) {
      const category: YearCategoryGrowthPct = {};
      const personnel = toFiniteNumber(payload.categoryGrowthPct.personnel);
      const energy = toFiniteNumber(payload.categoryGrowthPct.energy);
      const opexOther = toFiniteNumber(payload.categoryGrowthPct.opexOther);
      const otherIncome = toFiniteNumber(payload.categoryGrowthPct.otherIncome);
      const investments = toFiniteNumber(payload.categoryGrowthPct.investments);
      if (typeof personnel === 'number') category.personnel = personnel;
      if (typeof energy === 'number') category.energy = energy;
      if (typeof opexOther === 'number') category.opexOther = opexOther;
      if (typeof otherIncome === 'number') category.otherIncome = otherIncome;
      if (typeof investments === 'number') category.investments = investments;
      if (Object.keys(category).length > 0) next.categoryGrowthPct = category;
    }

    if (isObject(payload.lineOverrides)) {
      const lineOverrides: Record<string, YearLineOverride> = {};
      for (const [lineKey, lineRaw] of Object.entries(payload.lineOverrides)) {
        if (!isObject(lineRaw)) continue;
        if (lineRaw.mode !== 'percent' && lineRaw.mode !== 'absolute') continue;
        const value = toFiniteNumber(lineRaw.value);
        if (typeof value !== 'number') continue;
        lineOverrides[lineKey] = { mode: lineRaw.mode, value };
      }
      if (Object.keys(lineOverrides).length > 0) next.lineOverrides = lineOverrides;
    }

    if (Object.keys(next).length > 0) {
      out[year] = next;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function mergeUserInvestmentsIntoYearOverrides(
  yearOverrides: ProjectionYearOverrides | undefined,
  userInvestments: Array<{ year: number; amount: number }> | undefined,
): ProjectionYearOverrides | undefined {
  if (!yearOverrides && (!userInvestments || userInvestments.length === 0)) return undefined;
  const out: ProjectionYearOverrides = { ...(yearOverrides ?? {}) };
  for (const item of userInvestments ?? []) {
    if (!Number.isFinite(item.year) || !Number.isFinite(item.amount)) continue;
    const year = Math.round(item.year);
    out[year] = {
      ...(out[year] ?? {}),
      investmentEur: item.amount,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
