import type { TFunction } from 'i18next';

const GROUP_LABELS: Record<
  string,
  {
    labelKey: string;
    defaultLabel: string;
  }
> = {
  sanering_water_network: {
    labelKey: 'v2Vesinvest.groupSaneringWaterNetwork',
    defaultLabel: 'Water network rehabilitation',
  },
  sanering_wastewater_network: {
    labelKey: 'v2Vesinvest.groupSaneringWastewaterNetwork',
    defaultLabel: 'Wastewater network rehabilitation',
  },
  new_water_network: {
    labelKey: 'v2Vesinvest.groupNewWaterNetwork',
    defaultLabel: 'New water network',
  },
  new_wastewater_network: {
    labelKey: 'v2Vesinvest.groupNewWastewaterNetwork',
    defaultLabel: 'New wastewater network',
  },
  repair_water_network: {
    labelKey: 'v2Vesinvest.groupRepairWaterNetwork',
    defaultLabel: 'Water network repair',
  },
  repair_wastewater_network: {
    labelKey: 'v2Vesinvest.groupRepairWastewaterNetwork',
    defaultLabel: 'Wastewater network repair',
  },
  waterworks_equipment: {
    labelKey: 'v2Vesinvest.groupWaterworksEquipment',
    defaultLabel: 'Waterworks equipment',
  },
  wastewater_equipment: {
    labelKey: 'v2Vesinvest.groupWastewaterEquipment',
    defaultLabel: 'Wastewater equipment',
  },
  water_production: {
    labelKey: 'v2Vesinvest.groupWaterProduction',
    defaultLabel: 'Water production',
  },
  wastewater_treatment: {
    labelKey: 'v2Vesinvest.groupWastewaterTreatment',
    defaultLabel: 'Wastewater treatment',
  },
};

const REPORT_GROUP_LABELS: Record<
  string,
  {
    labelKey: string;
    defaultLabel: string;
  }
> = {
  network_rehabilitation: {
    labelKey: 'v2Vesinvest.reportGroupNetworkRehabilitation',
    defaultLabel: 'Network rehabilitation',
  },
  new_network: {
    labelKey: 'v2Vesinvest.reportGroupNewNetwork',
    defaultLabel: 'New network',
  },
  plant_equipment: {
    labelKey: 'v2Vesinvest.reportGroupPlantEquipment',
    defaultLabel: 'Plant equipment',
  },
  production: {
    labelKey: 'v2Vesinvest.reportGroupProduction',
    defaultLabel: 'Production',
  },
  treatment: {
    labelKey: 'v2Vesinvest.reportGroupTreatment',
    defaultLabel: 'Treatment',
  },
};

export function resolveVesinvestGroupLabel(
  t: TFunction,
  groupKey: string | null | undefined,
  fallbackLabel?: string | null,
): string {
  const normalizedKey = (groupKey ?? '').trim();
  const definition = normalizedKey ? GROUP_LABELS[normalizedKey] : undefined;
  if (definition) {
    return t(definition.labelKey, definition.defaultLabel);
  }
  return fallbackLabel?.trim() || normalizedKey || '-';
}

export function resolveVesinvestReportGroupLabel(
  t: TFunction,
  reportGroupKey: string | null | undefined,
  fallbackLabel?: string | null,
): string {
  const normalizedKey = (reportGroupKey ?? '').trim();
  const definition = normalizedKey ? REPORT_GROUP_LABELS[normalizedKey] : undefined;
  if (definition) {
    return t(definition.labelKey, definition.defaultLabel);
  }
  return fallbackLabel?.trim() || normalizedKey || '-';
}
