import React from 'react';

import type { V2VesinvestPlan } from '../api';
import type { VesinvestOverviewFocusTarget } from './vesinvestPlanningControllerTypes';

export function useVesinvestFeePathFocus({
  overviewFocusTarget,
  selectedPlanId,
  setSelectedPlanId,
  loading,
  loadingPlan,
  plans,
  plan,
  feePathSectionRef,
  feePathHeadingRef,
  onOverviewFocusTargetConsumed,
  pendingOverviewFocusPlanIdRef,
}: {
  overviewFocusTarget?: VesinvestOverviewFocusTarget | null;
  selectedPlanId: string | null;
  setSelectedPlanId: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  loadingPlan: boolean;
  plans: Array<{ id: string }>;
  plan: V2VesinvestPlan | null;
  feePathSectionRef: React.RefObject<HTMLElement | null>;
  feePathHeadingRef: React.RefObject<HTMLHeadingElement | null>;
  onOverviewFocusTargetConsumed?: () => void;
  pendingOverviewFocusPlanIdRef: React.MutableRefObject<string | null>;
}) {
  React.useEffect(() => {
    if (overviewFocusTarget?.kind !== 'saved_fee_path') {
      pendingOverviewFocusPlanIdRef.current = null;
      return;
    }
    pendingOverviewFocusPlanIdRef.current = overviewFocusTarget.planId;
    if (selectedPlanId !== overviewFocusTarget.planId) {
      setSelectedPlanId(overviewFocusTarget.planId);
    }
  }, [overviewFocusTarget, pendingOverviewFocusPlanIdRef, selectedPlanId, setSelectedPlanId]);

  React.useEffect(() => {
    const targetPlanId = pendingOverviewFocusPlanIdRef.current;
    if (!targetPlanId || loading || loadingPlan) {
      return;
    }
    if (selectedPlanId !== targetPlanId || plan?.id !== targetPlanId) {
      if (!plans.some((item) => item.id === targetPlanId)) {
        pendingOverviewFocusPlanIdRef.current = null;
        onOverviewFocusTargetConsumed?.();
      }
      return;
    }
    if (!feePathSectionRef.current || !feePathHeadingRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      feePathSectionRef.current?.scrollIntoView?.({ block: 'start', inline: 'nearest' });
      feePathHeadingRef.current?.focus();
      pendingOverviewFocusPlanIdRef.current = null;
      onOverviewFocusTargetConsumed?.();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    feePathHeadingRef,
    feePathSectionRef,
    loading,
    loadingPlan,
    onOverviewFocusTargetConsumed,
    pendingOverviewFocusPlanIdRef,
    plan?.id,
    plans,
    selectedPlanId,
  ]);
}
