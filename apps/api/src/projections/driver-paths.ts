import type { RevenueDriverInput } from './projection-engine.service';

export type DriverType = 'vesi' | 'jatevesi';
export type DriverField = 'yksikkohinta' | 'myytyMaara';

export type DriverPaths = Partial<Record<DriverType, Partial<Record<DriverField, DriverValuePlan>>>>;

export interface DriverValuePlan {
  mode: 'manual' | 'percent';
  baseYear?: number;
  baseValue?: number;
  annualPercent?: number;
  values?: Record<number, number>;
}

const SERVICE_TYPES: DriverType[] = ['vesi', 'jatevesi'];
const DRIVER_FIELDS: DriverField[] = ['yksikkohinta', 'myytyMaara'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toInteger = (value: unknown): number | undefined => {
  const num = toNumber(value);
  if (num === undefined) return undefined;
  const rounded = Math.round(num);
  return Number.isFinite(rounded) ? rounded : undefined;
};

const sanitizeValues = (raw: unknown): Record<number, number> | undefined => {
  if (!isObject(raw)) return undefined;
  const values: Record<number, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    const year = toInteger(key);
    const amount = toNumber(val);
    if (year !== undefined && amount !== undefined) {
      values[year] = amount;
    }
  }
  return Object.keys(values).length > 0 ? values : undefined;
};

export function normalizeDriverPaths(raw: unknown): DriverPaths | undefined {
  if (!isObject(raw)) return undefined;
  const normalized: DriverPaths = {};

  for (const service of SERVICE_TYPES) {
    const serviceInput = raw[service];
    if (!isObject(serviceInput)) continue;
    const servicePlan: Partial<Record<DriverField, DriverValuePlan>> = {};

    for (const field of DRIVER_FIELDS) {
      const fieldInput = serviceInput[field];
      if (!isObject(fieldInput)) continue;
      const mode: 'manual' | 'percent' = fieldInput.mode === 'percent' ? 'percent' : 'manual';
      const baseYear = toInteger(fieldInput.baseYear);
      const baseValue = toNumber(fieldInput.baseValue);
      const annualPercent = toNumber(fieldInput.annualPercent);
      const values = sanitizeValues(fieldInput.values);

      const plan: DriverValuePlan = { mode };
      if (baseYear !== undefined) plan.baseYear = baseYear;
      if (baseValue !== undefined) plan.baseValue = baseValue;
      if (annualPercent !== undefined) plan.annualPercent = annualPercent;
      if (values) plan.values = values;

      const hasManualValues = values && Object.keys(values).length > 0;
      const hasPercentSettings = plan.mode === 'percent' && annualPercent !== undefined;

      if (hasManualValues || hasPercentSettings) {
        servicePlan[field] = plan;
      }
    }

    if (Object.keys(servicePlan).length > 0) {
      normalized[service] = servicePlan;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function resolveDriverValue(
  driverPaths: DriverPaths | undefined,
  driver: RevenueDriverInput,
  field: DriverField,
  year: number,
  defaultBaseValue: number,
  defaultComputedValue: number,
): number {
  if (!driverPaths) return defaultComputedValue;
  if (driver.palvelutyyppi !== 'vesi' && driver.palvelutyyppi !== 'jatevesi') {
    return defaultComputedValue;
  }
  const plan = driverPaths[driver.palvelutyyppi]?.[field];
  if (!plan) return defaultComputedValue;

  const manualValue = plan.values?.[year];
  if (typeof manualValue === 'number' && Number.isFinite(manualValue)) {
    return manualValue;
  }

  if (plan.mode === 'percent' && plan.annualPercent !== undefined) {
    const baseYear = plan.baseYear ?? year;
    const baseValue = plan.baseValue
      ?? (plan.values && plan.values[baseYear])
      ?? defaultBaseValue;
    if (!Number.isFinite(baseValue)) return defaultComputedValue;
    const diff = year - baseYear;
    const computed = baseValue * Math.pow(1 + plan.annualPercent, diff);
    if (!Number.isFinite(computed)) return defaultComputedValue;
    return round2(computed);
  }

  return defaultComputedValue;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Synthesize RevenueDriverInput[] from driverPaths when budget has no tuloajurit.
 * Uses manual values or baseValue (percent mode) for base year. Per-service defaults: yksikkohinta=0, myytyMaara=0.
 */
export function synthesizeDriversFromPaths(
  driverPaths: DriverPaths | undefined,
  baseYear: number,
): RevenueDriverInput[] {
  if (!driverPaths) return [];
  const drivers: RevenueDriverInput[] = [];
  for (const palvelutyyppi of SERVICE_TYPES) {
    const service = driverPaths[palvelutyyppi];
    if (!service) {
      drivers.push({
        palvelutyyppi: palvelutyyppi as 'vesi' | 'jatevesi',
        yksikkohinta: 0,
        myytyMaara: 0,
        perusmaksu: 0,
        liittymamaara: 0,
      });
      continue;
    }
    const getBase = (field: DriverField): number => {
      const plan = service[field];
      if (!plan) return 0;
      const manual = plan.values?.[baseYear];
      if (typeof manual === 'number' && Number.isFinite(manual)) return manual;
      if (plan.mode === 'percent' && plan.baseValue != null && Number.isFinite(plan.baseValue)) return plan.baseValue;
      if (plan.values) {
        const years = Object.keys(plan.values).map(Number).filter(Number.isFinite);
        if (years.length > 0) {
          const nearest = years.reduce((a, b) => (Math.abs(b - baseYear) < Math.abs(a - baseYear) ? b : a));
          const v = plan.values[nearest];
          if (typeof v === 'number' && Number.isFinite(v)) return v;
        }
      }
      return 0;
    };
    drivers.push({
      palvelutyyppi: palvelutyyppi as 'vesi' | 'jatevesi',
      yksikkohinta: round2(getBase('yksikkohinta')),
      myytyMaara: round2(getBase('myytyMaara')),
      perusmaksu: 0,
      liittymamaara: 0,
    });
  }
  return drivers;
}
