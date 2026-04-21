import React from 'react';
import type { TFunction } from 'i18next';

import { excludeImportYearsV2, restoreImportYearsV2 } from '../api';

type LoadOverviewInternalOptions = {
  preserveVisibleState?: boolean;
  preserveSelectionState?: boolean;
  preserveReviewContinueStep?: boolean;
  deferSecondaryLoads?: boolean;
};

type Params = {
  t: TFunction;
  selectedYearsForDelete: number[];
  selectedYearsForRestore: number[];
  selectedYearsRef: React.MutableRefObject<number[]>;
  selectedYearsForDeleteRef: React.MutableRefObject<number[]>;
  selectedYearsForRestoreRef: React.MutableRefObject<number[]>;
  syncYearSelectionTouchedRef: React.MutableRefObject<boolean>;
  setSelectedYears: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectedYearsForDelete: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectedYearsForRestore: React.Dispatch<React.SetStateAction<number[]>>;
  setExcludedYearOverrides: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  setRemovingYear: React.Dispatch<React.SetStateAction<number | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInfo: React.Dispatch<React.SetStateAction<string | null>>;
  setBulkDeletingYears: React.Dispatch<React.SetStateAction<boolean>>;
  setBulkRestoringYears: React.Dispatch<React.SetStateAction<boolean>>;
  loadOverview: () => Promise<void>;
  loadOverviewInternal: (options?: LoadOverviewInternalOptions) => Promise<boolean>;
};

export function useOverviewImportMaintenance({
  t,
  selectedYearsForDelete,
  selectedYearsForRestore,
  selectedYearsRef,
  selectedYearsForDeleteRef,
  selectedYearsForRestoreRef,
  syncYearSelectionTouchedRef,
  setSelectedYears,
  setSelectedYearsForDelete,
  setSelectedYearsForRestore,
  setExcludedYearOverrides,
  setRemovingYear,
  setError,
  setInfo,
  setBulkDeletingYears,
  setBulkRestoringYears,
  loadOverview,
  loadOverviewInternal,
}: Params) {
  const toggleYearForDelete = React.useCallback((year: number) => {
    setSelectedYearsForDelete((prev) =>
      prev.includes(year)
        ? prev.filter((item) => item !== year)
        : [...prev, year].sort((a, b) => a - b),
    );
  }, [setSelectedYearsForDelete]);

  const toggleYearForRestore = React.useCallback((year: number) => {
    setSelectedYearsForRestore((prev) =>
      prev.includes(year)
        ? prev.filter((item) => item !== year)
        : [...prev, year].sort((a, b) => a - b),
    );
  }, [setSelectedYearsForRestore]);

  const handleBulkDeleteYears = React.useCallback(async () => {
    if (selectedYearsForDelete.length === 0) return;
    const yearsLabel = [...selectedYearsForDelete].sort((a, b) => a - b).join(', ');
    const confirmed = window.confirm(
      t(
        'v2Overview.excludeYearsBulkConfirm',
        'Rajataanko vuodet {{years}} pois suunnitelmasta? Vuodet säilyvät työtilassa ja ne voi palauttaa myöhemmin.',
        { years: yearsLabel },
      ),
    );
    if (!confirmed) return;

    setBulkDeletingYears(true);
    setError(null);
    setInfo(null);
    try {
      const result = await excludeImportYearsV2(selectedYearsForDelete);
      const skippedYears = result.results
        .filter((row) => row.reason !== null)
        .map((row) => row.vuosi);
      if (skippedYears.length > 0) {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkPartial',
            'Rajattiin {{excluded}} vuosi/vuotta pois suunnitelmasta. {{skipped}} vuosi/vuotta oli jo rajattu: {{years}}.',
            {
              excluded: result.excludedCount,
              skipped: result.alreadyExcludedCount,
              years: skippedYears.join(', '),
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkDone',
            'Vuodet rajattiin pois suunnitelmasta: {{count}}.',
            { count: result.excludedCount },
          ),
        );
      }
      setSelectedYearsForDelete([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearsBulkFailed',
              'Valittujen vuosien rajaaminen pois suunnitelmasta epäonnistui.',
            ),
      );
    } finally {
      setBulkDeletingYears(false);
    }
  }, [
    loadOverview,
    selectedYearsForDelete,
    setBulkDeletingYears,
    setError,
    setInfo,
    setSelectedYearsForDelete,
    t,
  ]);

  const handleBulkRestoreYears = React.useCallback(async () => {
    if (selectedYearsForRestore.length === 0) return;
    setBulkRestoringYears(true);
    setError(null);
    setInfo(null);
    try {
      const result = await restoreImportYearsV2(selectedYearsForRestore);
      const notRestored = result.results.filter((row) => !row.restored);
      if (notRestored.length > 0) {
        setInfo(
          t(
            'v2Overview.restoreYearsBulkPartial',
            'Restored {{restored}} year(s). {{missing}} year(s) were not excluded.',
            {
              restored: result.restoredCount,
              missing: result.notExcludedCount,
            },
          ),
        );
      } else {
        setInfo(
          t('v2Overview.restoreYearsBulkDone', 'Restored {{count}} year(s).', {
            count: result.restoredCount,
          }),
        );
      }
      setSelectedYearsForRestore([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.restoreYearsBulkFailed', 'Failed to restore selected years.'),
      );
    } finally {
      setBulkRestoringYears(false);
    }
  }, [
    loadOverview,
    selectedYearsForRestore,
    setBulkRestoringYears,
    setError,
    setInfo,
    setSelectedYearsForRestore,
    t,
  ]);

  const excludeYearFromImportBoard = React.useCallback(
    async (year: number) => {
      const previousSelectedYears = selectedYearsRef.current;
      const nextSelectedYears = previousSelectedYears.filter((item) => item !== year);

      syncYearSelectionTouchedRef.current = true;
      setSelectedYears(nextSelectedYears);
      selectedYearsRef.current = nextSelectedYears;
      setSelectedYearsForDelete((prev) => prev.filter((item) => item !== year));
      setSelectedYearsForRestore((prev) => prev.filter((item) => item !== year));
      selectedYearsForDeleteRef.current = selectedYearsForDeleteRef.current.filter(
        (item) => item !== year,
      );
      selectedYearsForRestoreRef.current = selectedYearsForRestoreRef.current.filter(
        (item) => item !== year,
      );
      setExcludedYearOverrides((prev) => ({ ...prev, [year]: true }));
      setRemovingYear(year);
      setError(null);
      setInfo(null);
      try {
        const result = await excludeImportYearsV2([year]);
        const skippedYears = result.results
          .filter((row) => row.reason !== null)
          .map((row) => row.vuosi);
        if (skippedYears.length > 0) {
          setInfo(
            t(
              'v2Overview.excludeYearsBulkPartial',
              'Rajattiin {{excluded}} vuosi/vuotta pois suunnitelmasta. {{skipped}} vuosi/vuotta oli jo rajattu: {{years}}.',
              {
                excluded: result.excludedCount,
                skipped: result.alreadyExcludedCount,
                years: skippedYears.join(', '),
              },
            ),
          );
        } else {
          setInfo(
            t(
              'v2Overview.excludeYearsBulkDone',
              'Vuodet rajattiin pois suunnitelmasta: {{count}}.',
              { count: result.excludedCount },
            ),
          );
        }
        const refreshSucceeded = await loadOverviewInternal({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
        if (refreshSucceeded) {
          setExcludedYearOverrides((prev) => {
            const next = { ...prev };
            delete next[year];
            return next;
          });
        }
      } catch (err) {
        setSelectedYears(previousSelectedYears);
        selectedYearsRef.current = previousSelectedYears;
        setExcludedYearOverrides((prev) => {
          const next = { ...prev };
          delete next[year];
          return next;
        });
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.excludeYearsBulkFailed',
                'Valittujen vuosien rajaaminen pois suunnitelmasta epäonnistui.',
              ),
        );
      } finally {
        setRemovingYear(null);
      }
    },
    [
      loadOverviewInternal,
      selectedYearsForDeleteRef,
      selectedYearsForRestoreRef,
      selectedYearsRef,
      setError,
      setExcludedYearOverrides,
      setInfo,
      setRemovingYear,
      setSelectedYears,
      setSelectedYearsForDelete,
      setSelectedYearsForRestore,
      syncYearSelectionTouchedRef,
      t,
    ],
  );

  const restoreYearFromImportBoard = React.useCallback(
    async (year: number) => {
      setSelectedYearsForDelete((prev) => prev.filter((item) => item !== year));
      setSelectedYearsForRestore((prev) => prev.filter((item) => item !== year));
      selectedYearsForDeleteRef.current = selectedYearsForDeleteRef.current.filter(
        (item) => item !== year,
      );
      selectedYearsForRestoreRef.current = selectedYearsForRestoreRef.current.filter(
        (item) => item !== year,
      );
      setExcludedYearOverrides((prev) => ({ ...prev, [year]: false }));
      setRemovingYear(year);
      setError(null);
      setInfo(null);
      try {
        const result = await restoreImportYearsV2([year]);
        const notRestored = result.results.filter((row) => !row.restored);
        if (notRestored.length > 0) {
          setInfo(
            t(
              'v2Overview.restoreYearsBulkPartial',
              'Restored {{restored}} year(s). {{missing}} year(s) were not excluded.',
              {
                restored: result.restoredCount,
                missing: result.notExcludedCount,
              },
            ),
          );
        } else {
          setInfo(
            t('v2Overview.restoreYearsBulkDone', 'Restored {{count}} year(s).', {
              count: result.restoredCount,
            }),
          );
        }
        const refreshSucceeded = await loadOverviewInternal({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
        if (refreshSucceeded) {
          setExcludedYearOverrides((prev) => {
            const next = { ...prev };
            delete next[year];
            return next;
          });
        }
      } catch (err) {
        setExcludedYearOverrides((prev) => {
          const next = { ...prev };
          delete next[year];
          return next;
        });
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.restoreYearsBulkFailed',
                'Failed to restore selected years.',
              ),
        );
      } finally {
        setRemovingYear(null);
      }
    },
    [
      loadOverviewInternal,
      selectedYearsForDeleteRef,
      selectedYearsForRestoreRef,
      setError,
      setExcludedYearOverrides,
      setInfo,
      setRemovingYear,
      setSelectedYearsForDelete,
      setSelectedYearsForRestore,
      t,
    ],
  );

  const handleGuideBlockedYears = React.useCallback(() => {
    document.getElementById('v2-import-years')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  return {
    excludeYearFromImportBoard,
    handleBulkDeleteYears,
    handleBulkRestoreYears,
    handleGuideBlockedYears,
    restoreYearFromImportBoard,
    toggleYearForDelete,
    toggleYearForRestore,
  };
}
