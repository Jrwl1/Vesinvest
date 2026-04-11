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

export type VesinvestPlanProjectClassificationRecord = {
  groupKey: string;
  depreciationClassKey?: string | null;
  accountKey?: string | null;
};

export type VesinvestGroupClassificationDefaults = {
  defaultAccountKey?: string | null;
  defaultDepreciationClassKey?: string | null;
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
    defaultDepreciationClassKey: 'sanering_water_network',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'water',
  },
  {
    key: 'sanering_wastewater_network',
    label: 'Sanering / avloppsnatverk',
    defaultAccountKey: 'sanering_wastewater_network',
    defaultDepreciationClassKey: 'sanering_wastewater_network',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'wastewater',
  },
  {
    key: 'new_water_network',
    label: 'Nyanlaggning / vattennatverk',
    defaultAccountKey: 'new_water_network',
    defaultDepreciationClassKey: 'new_water_network',
    reportGroupKey: 'new_network',
    serviceSplit: 'water',
  },
  {
    key: 'new_wastewater_network',
    label: 'Nyanlaggning / avloppsnatverk',
    defaultAccountKey: 'new_wastewater_network',
    defaultDepreciationClassKey: 'new_wastewater_network',
    reportGroupKey: 'new_network',
    serviceSplit: 'wastewater',
  },
  {
    key: 'repair_water_network',
    label: 'Reparation / vattennatverk',
    defaultAccountKey: 'repair_water_network',
    defaultDepreciationClassKey: 'repair_water_network',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'water',
  },
  {
    key: 'repair_wastewater_network',
    label: 'Reparation / avloppsnatverk',
    defaultAccountKey: 'repair_wastewater_network',
    defaultDepreciationClassKey: 'repair_wastewater_network',
    reportGroupKey: 'network_rehabilitation',
    serviceSplit: 'wastewater',
  },
  {
    key: 'waterworks_equipment',
    label: 'Vattenverksapparatur',
    defaultAccountKey: 'waterworks_equipment',
    defaultDepreciationClassKey: 'waterworks_equipment',
    reportGroupKey: 'plant_equipment',
    serviceSplit: 'water',
  },
  {
    key: 'wastewater_equipment',
    label: 'Avloppsapparatur',
    defaultAccountKey: 'wastewater_equipment',
    defaultDepreciationClassKey: 'wastewater_equipment',
    reportGroupKey: 'plant_equipment',
    serviceSplit: 'wastewater',
  },
  {
    key: 'water_production',
    label: 'Vattenproduktion',
    defaultAccountKey: 'water_production',
    defaultDepreciationClassKey: 'water_production',
    reportGroupKey: 'production',
    serviceSplit: 'water',
  },
  {
    key: 'wastewater_treatment',
    label: 'Avloppsrening',
    defaultAccountKey: 'wastewater_treatment',
    defaultDepreciationClassKey: 'wastewater_treatment',
    reportGroupKey: 'treatment',
    serviceSplit: 'wastewater',
  },
];

export const VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY: Record<
  string,
  string
> = {
  sanering_water_network: 'water_network_post_1999',
  sanering_wastewater_network: 'wastewater_network_post_1999',
  new_water_network: 'water_network_post_1999',
  new_wastewater_network: 'wastewater_network_post_1999',
  repair_water_network: 'water_network_post_1999',
  repair_wastewater_network: 'wastewater_network_post_1999',
  waterworks_equipment: 'plant_machinery',
  wastewater_equipment: 'plant_machinery',
  water_production: 'plant_buildings',
  wastewater_treatment: 'plant_buildings',
};

const DEFAULT_VESINVEST_GROUP_ORDER = new Map(
  DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group, index) => [group.key, index] as const),
);

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function sortVesinvestGroupDefinitions(
  groups: VesinvestGroupDefinitionRecord[],
): VesinvestGroupDefinitionRecord[] {
  return [...groups].sort((left, right) => {
    const leftOrder =
      DEFAULT_VESINVEST_GROUP_ORDER.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      DEFAULT_VESINVEST_GROUP_ORDER.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.label.localeCompare(right.label);
  });
}

export function normalizeVesinvestDepreciationClassKey(
  groupKey: string,
  rawValue: string | null | undefined,
): string | null {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return null;
  }
  if (normalized === groupKey) {
    return groupKey;
  }
  const legacyKey = VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY[groupKey];
  if (legacyKey && normalized === legacyKey) {
    return groupKey;
  }
  return normalized;
}

export function expandLegacyDepreciationRuleKeyToVesinvestClasses(
  assetClassKey: string | null | undefined,
): string[] {
  const normalized = normalizeText(assetClassKey);
  if (!normalized) {
    return [];
  }
  if (DEFAULT_VESINVEST_GROUP_ORDER.has(normalized)) {
    return [normalized];
  }
  return DEFAULT_VESINVEST_GROUP_DEFINITIONS.filter(
    (group) =>
      VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY[group.key] === normalized,
  ).map((group) => group.key);
}

export function isVesinvestClassificationReviewRequired(
  projects: VesinvestPlanProjectClassificationRecord[],
  groupDefaultsByKey?: Map<string, VesinvestGroupClassificationDefaults>,
): boolean {
  const grouped = new Map<
    string,
    {
      accountKeys: Set<string>;
      depreciationClassKeys: Set<string>;
      hasAccountOverride: boolean;
      hasDepreciationOverride: boolean;
    }
  >();

  for (const project of projects) {
    const current = grouped.get(project.groupKey) ?? {
      accountKeys: new Set<string>(),
      depreciationClassKeys: new Set<string>(),
      hasAccountOverride: false,
      hasDepreciationOverride: false,
    };
    const groupDefaults = groupDefaultsByKey?.get(project.groupKey) ?? null;
    const authoritativeAccountKey = normalizeText(
      groupDefaults?.defaultAccountKey ?? null,
    );
    const authoritativeDepreciationClassKey =
      normalizeVesinvestDepreciationClassKey(
        project.groupKey,
        groupDefaults?.defaultDepreciationClassKey ?? project.groupKey,
      ) ?? project.groupKey;
    const accountKey = normalizeText(project.accountKey);
    if (accountKey) {
      current.accountKeys.add(accountKey);
      if (
        authoritativeAccountKey &&
        accountKey !== authoritativeAccountKey
      ) {
        current.hasAccountOverride = true;
      }
    }
    const depreciationClassKey = normalizeVesinvestDepreciationClassKey(
      project.groupKey,
      project.depreciationClassKey,
    );
    if (depreciationClassKey) {
      current.depreciationClassKeys.add(depreciationClassKey);
      if (depreciationClassKey !== authoritativeDepreciationClassKey) {
        current.hasDepreciationOverride = true;
      }
    }
    grouped.set(project.groupKey, current);
  }

  return [...grouped.values()].some(
    (entry) =>
      entry.accountKeys.size > 1 ||
      entry.depreciationClassKeys.size > 1 ||
      entry.hasAccountOverride ||
      entry.hasDepreciationOverride,
  );
}

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
