import type { TFunction } from 'i18next';

import type { V2PlanningContextResponse } from '../api';
import type { VesinvestLinkedOrg } from './vesinvestPlanningModel';

export type VesinvestProjectComposerState = {
  open: boolean;
  code: string;
  groupKey: string;
  name: string;
};

export type VesinvestVeetiSearchHit = {
  id: number;
  name: string;
  businessId: string | null;
  municipality: string | null;
};

export type VesinvestOverviewFocusTarget = {
  kind: 'saved_fee_path';
  planId: string;
};

export type VesinvestPlanningControllerParams = {
  t: TFunction;
  isAdmin?: boolean;
  simplifiedSetup?: boolean;
  compactReviewMode?: boolean;
  planningContext: V2PlanningContextResponse | null;
  linkedOrg: VesinvestLinkedOrg;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  overviewFocusTarget?: VesinvestOverviewFocusTarget | null;
  onOverviewFocusTargetConsumed?: () => void;
  onSavedFeePathReportConflict?: (planId?: string | null) => void;
  onPlansChanged?: () => Promise<void> | void;
};
