import type { VeetiDataType } from './veeti.service';

export type VeetiImportMode = 'yearly' | 'static';

export type VeetiImportContractEntry = {
  dataType: VeetiDataType;
  entity: string;
  mode: VeetiImportMode;
  requiredForEnnuste: boolean;
  orderBy?: string;
};

const CONTRACT_ROWS: VeetiImportContractEntry[] = [
  {
    dataType: 'tilinpaatos',
    entity: 'Tilinpaatos',
    mode: 'yearly',
    requiredForEnnuste: true,
    orderBy: 'Vuosi asc',
  },
  {
    dataType: 'taksa',
    entity: 'TaksaKayttomaksu',
    mode: 'yearly',
    requiredForEnnuste: true,
    orderBy: 'Vuosi asc,Tyyppi_Id asc',
  },
  {
    dataType: 'volume_vesi',
    entity: 'LaskutettuTalousvesi',
    mode: 'yearly',
    requiredForEnnuste: true,
    orderBy: 'Vuosi asc',
  },
  {
    dataType: 'volume_jatevesi',
    entity: 'LaskutettuJatevesi',
    mode: 'yearly',
    requiredForEnnuste: true,
    orderBy: 'Vuosi asc',
  },
  {
    dataType: 'investointi',
    entity: 'Investointi',
    mode: 'yearly',
    requiredForEnnuste: false,
    orderBy: 'Vuosi asc',
  },
  {
    dataType: 'energia',
    entity: 'EnergianKaytto',
    mode: 'yearly',
    requiredForEnnuste: false,
    orderBy: 'Vuosi asc',
  },
  {
    dataType: 'verkko',
    entity: 'Verkko',
    mode: 'static',
    requiredForEnnuste: false,
  },
];

export const VEETI_IMPORT_CONTRACT: Record<
  VeetiDataType,
  VeetiImportContractEntry
> = CONTRACT_ROWS.reduce((acc, row) => {
  acc[row.dataType] = row;
  return acc;
}, {} as Record<VeetiDataType, VeetiImportContractEntry>);

export const VEETI_IMPORT_DATA_TYPES: VeetiDataType[] = CONTRACT_ROWS.map(
  (row) => row.dataType,
);

export const VEETI_TARIFF_SCOPE = 'usage_fee_only';

export function isStaticDataType(dataType: VeetiDataType): boolean {
  return VEETI_IMPORT_CONTRACT[dataType].mode === 'static';
}

export function getStaticSnapshotYearForDataType(
  dataType: VeetiDataType,
): number | null {
  return isStaticDataType(dataType) ? 0 : null;
}
