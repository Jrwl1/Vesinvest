import { createHash } from 'node:crypto';

export type VesinvestServiceSplit = 'water' | 'wastewater' | 'mixed';

export type VesinvestGroupDefinitionRecord = {
  key: string;
  label: string;
  defaultAccountKey: string;
  defaultDepreciationClassKey: string | null;
  reportGroupKey: string;
  serviceSplit: VesinvestServiceSplit;
};

export type VesinvestReportGroupDefinition = {
  key: string;
  label: string;
};

export type VesinvestUtilityIdentitySnapshot = {
  veetiId: number;
  utilityName: string;
  businessId: string | null;
  identitySource: 'veeti';
};

export const DEFAULT_VESINVEST_REPORT_GROUP_DEFINITIONS: VesinvestReportGroupDefinition[] =
  [
    {
      key: 'network_rehabilitation',
      label: 'Network rehabilitation',
    },
    {
      key: 'new_network',
      label: 'New network',
    },
    {
      key: 'plant_equipment',
      label: 'Plant equipment',
    },
    {
      key: 'production',
      label: 'Production',
    },
    {
      key: 'treatment',
      label: 'Treatment',
    },
  ];

export const DEFAULT_VESINVEST_GROUP_DEFINITIONS: VesinvestGroupDefinitionRecord[] = [
  {
    key: 'sanering_water_network',
    label: 'Sanering / vattennatverk',
    defaultAccountKey: 'sanering_water_network',
    defaultDepreciationClassKey: 'water_network_post_1999',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'water',
  },
  {
    key: 'sanering_wastewater_network',
    label: 'Sanering / avloppsnatverk',
    defaultAccountKey: 'sanering_wastewater_network',
    defaultDepreciationClassKey: 'wastewater_network_post_1999',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'wastewater',
  },
  {
    key: 'new_water_network',
    label: 'Nyanlaggning / vattennatverk',
    defaultAccountKey: 'new_water_network',
    defaultDepreciationClassKey: 'water_network_post_1999',
    reportGroupKey: 'new_network',
    serviceSplit: 'water',
  },
  {
    key: 'new_wastewater_network',
    label: 'Nyanlaggning / avloppsnatverk',
    defaultAccountKey: 'new_wastewater_network',
    defaultDepreciationClassKey: 'wastewater_network_post_1999',
    reportGroupKey: 'new_network',
    serviceSplit: 'wastewater',
  },
  {
    key: 'waterworks_equipment',
    label: 'Vattenverksapparatur',
    defaultAccountKey: 'waterworks_equipment',
    defaultDepreciationClassKey: 'plant_machinery',
    reportGroupKey: 'plant_equipment',
    serviceSplit: 'water',
  },
  {
    key: 'wastewater_equipment',
    label: 'Avloppsapparatur',
    defaultAccountKey: 'wastewater_equipment',
    defaultDepreciationClassKey: 'plant_machinery',
    reportGroupKey: 'plant_equipment',
    serviceSplit: 'wastewater',
  },
  {
    key: 'water_production',
    label: 'Vattenproduktion',
    defaultAccountKey: 'water_production',
    defaultDepreciationClassKey: 'plant_buildings',
    reportGroupKey: 'production',
    serviceSplit: 'water',
  },
  {
    key: 'wastewater_treatment',
    label: 'Avloppsrening',
    defaultAccountKey: 'wastewater_treatment',
    defaultDepreciationClassKey: 'plant_buildings',
    reportGroupKey: 'treatment',
    serviceSplit: 'wastewater',
  },
];

export type VesinvestBaselineFingerprintInput = {
  acceptedYears: number[];
  latestAcceptedBudgetId: string | null;
  baselineYears?: unknown;
  utilityIdentity?: VesinvestUtilityIdentitySnapshot | null;
};

export function computeVesinvestBaselineFingerprint(
  input: VesinvestBaselineFingerprintInput,
): string {
  return stableHash({
    acceptedYears: [...input.acceptedYears].sort((left, right) => left - right),
    latestAcceptedBudgetId: input.latestAcceptedBudgetId ?? null,
    baselineYears: input.baselineYears ?? null,
    utilityIdentity: input.utilityIdentity ?? null,
  });
}

export type VesinvestScenarioFingerprintInput = {
  scenarioId: string;
  updatedAt: string | Date | null;
  computedFromUpdatedAt: string | Date | null;
  yearlyInvestments: unknown;
  years?: unknown;
};

export function computeVesinvestScenarioFingerprint(
  input: VesinvestScenarioFingerprintInput,
): string {
  return stableHash({
    scenarioId: input.scenarioId,
    updatedAt: normalizeDateValue(input.updatedAt),
    computedFromUpdatedAt: normalizeDateValue(input.computedFromUpdatedAt),
    yearlyInvestments: input.yearlyInvestments ?? [],
    years: input.years ?? null,
  });
}

function normalizeDateValue(value: string | Date | null): string | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value, stableJsonReplacer))
    .digest('hex');
}

function stableJsonReplacer(_key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonReplacer('', item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, entryValue]) => [
          entryKey,
          stableJsonReplacer(entryKey, entryValue),
        ]),
    );
  }
  return value;
}
