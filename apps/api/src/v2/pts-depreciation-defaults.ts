export type PtsScenarioDepreciationRuleDefault = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: 'straight-line' | 'residual' | 'none';
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule: number[] | null;
};

// Derived from docs/client/Investeringsplan PTS.xlsx, sheet "Avskrivningsregler".
export const PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS: PtsScenarioDepreciationRuleDefault[] =
  [
    {
      id: 'pts-plant-buildings',
      assetClassKey: 'plant_buildings',
      assetClassName: 'Fabriks- och produktionsbyggnader',
      method: 'straight-line',
      linearYears: 20,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-economic-buildings',
      assetClassKey: 'economic_buildings',
      assetClassName: 'Ekonomibyggnader',
      method: 'straight-line',
      linearYears: 15,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-water-network-pre-1999',
      assetClassKey: 'water_network_pre_1999',
      assetClassName: 'Vattendistributionsnät före 1999',
      method: 'straight-line',
      linearYears: 15,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-water-network-post-1999',
      assetClassKey: 'water_network_post_1999',
      assetClassName: 'Vattendistributionsnät från 1999',
      method: 'straight-line',
      linearYears: 25,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-wastewater-network-pre-1999',
      assetClassKey: 'wastewater_network_pre_1999',
      assetClassName: 'Avloppsledningsnät före 1999',
      method: 'straight-line',
      linearYears: 15,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-wastewater-network-post-1999',
      assetClassKey: 'wastewater_network_post_1999',
      assetClassName: 'Avloppsledningsnät från 1999',
      method: 'straight-line',
      linearYears: 25,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-plant-machinery',
      assetClassKey: 'plant_machinery',
      assetClassName: 'Maskiner och anordningar vid vatten- och avloppsverk',
      method: 'residual',
      linearYears: null,
      residualPercent: 10,
      annualSchedule: null,
    },
    {
      id: 'pts-it-equipment',
      assetClassKey: 'it_equipment',
      assetClassName: 'ADB-utrustning',
      method: 'straight-line',
      linearYears: 3,
      residualPercent: null,
      annualSchedule: null,
    },
    {
      id: 'pts-other-equipment',
      assetClassKey: 'other_equipment',
      assetClassName: 'Övriga anordningar och inventarier',
      method: 'residual',
      linearYears: null,
      residualPercent: 25,
      annualSchedule: null,
    },
    {
      id: 'pts-ongoing-acquisitions',
      assetClassKey: 'ongoing_acquisitions',
      assetClassName: 'Pågående anskaffningar',
      method: 'none',
      linearYears: null,
      residualPercent: null,
      annualSchedule: null,
    },
  ];
