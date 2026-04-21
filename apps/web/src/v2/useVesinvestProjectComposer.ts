import React from 'react';

import type { V2VesinvestGroupDefinition } from '../api';
import type { VesinvestProjectComposerState } from './vesinvestPlanningControllerTypes';
import {
  createProject,
  FALLBACK_GROUP_KEY,
  resolveProjectGroup,
  type VesinvestDraft,
} from './vesinvestPlanningModel';

export function useVesinvestProjectComposer({
  groups,
  loading,
  loadingPlan,
  projectComposer,
  setProjectComposer,
  setDraft,
  draft,
  pendingAllocationFocusRef,
}: {
  groups: V2VesinvestGroupDefinition[];
  loading: boolean;
  loadingPlan: boolean;
  projectComposer: VesinvestProjectComposerState;
  setProjectComposer: React.Dispatch<React.SetStateAction<VesinvestProjectComposerState>>;
  setDraft: React.Dispatch<React.SetStateAction<VesinvestDraft>>;
  draft: VesinvestDraft;
  pendingAllocationFocusRef: React.MutableRefObject<{
    projectIndex: number;
    year: number;
  } | null>;
}) {
  const projectComposerGroupKey =
    resolveProjectGroup(groups, projectComposer.groupKey)?.key ?? FALLBACK_GROUP_KEY;

  const openProjectComposer = React.useCallback(() => {
    if (loading || loadingPlan || groups.length === 0) {
      return;
    }
    const defaultGroupKey = resolveProjectGroup(groups, null)?.key ?? FALLBACK_GROUP_KEY;
    setProjectComposer({
      open: true,
      code: '',
      groupKey: defaultGroupKey,
      name: '',
    });
  }, [groups, loading, loadingPlan, setProjectComposer]);

  const closeProjectComposer = React.useCallback(() => {
    setProjectComposer((current) => ({
      ...current,
      open: false,
      code: '',
      name: '',
    }));
  }, [setProjectComposer]);

  const handleCreateProjectDraft = React.useCallback(() => {
    const projectCode = projectComposer.code.trim();
    const projectName = projectComposer.name.trim();
    const resolvedGroup = resolveProjectGroup(groups, projectComposerGroupKey);
    if (!projectCode || !projectName || resolvedGroup == null) {
      return;
    }
    setDraft((current) => {
      pendingAllocationFocusRef.current = {
        projectIndex: current.projects.length,
        year: current.horizonYearsRange[0] ?? new Date().getFullYear(),
      };
      return {
        ...current,
        projects: [
          ...current.projects,
          createProject(current.horizonYearsRange, groups, current.projects.length, {
            code: projectCode,
            name: projectName,
            groupKey: resolvedGroup.key,
          }),
        ],
      };
    });
    setProjectComposer({
      open: false,
      code: '',
      groupKey: resolvedGroup.key,
      name: '',
    });
  }, [
    groups,
    pendingAllocationFocusRef,
    projectComposer.code,
    projectComposer.name,
    projectComposerGroupKey,
    setDraft,
    setProjectComposer,
  ]);

  React.useEffect(() => {
    const pendingFocus = pendingAllocationFocusRef.current;
    if (!pendingFocus || typeof document === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const projectSection = document.querySelector<HTMLElement>(
        `[data-vesinvest-project-index="${pendingFocus.projectIndex}"]`,
      );
      projectSection?.scrollIntoView?.({ block: 'center', inline: 'nearest' });

      const allocationInput = document.querySelector<HTMLInputElement>(
        `input[name="vesinvest-allocation-${pendingFocus.projectIndex}-totalAmount-${pendingFocus.year}"]`,
      );
      if (!allocationInput) {
        return;
      }
      allocationInput.focus();
      allocationInput.select?.();
      pendingAllocationFocusRef.current = null;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [draft.horizonYearsRange, draft.projects, pendingAllocationFocusRef]);

  return {
    projectComposerGroupKey,
    openProjectComposer,
    closeProjectComposer,
    handleCreateProjectDraft,
  };
}
