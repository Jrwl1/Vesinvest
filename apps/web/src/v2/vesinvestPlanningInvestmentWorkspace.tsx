import type { TFunction } from 'i18next';
import React from 'react';

import type { V2VesinvestGroupDefinition, V2VesinvestPlan, V2VesinvestProject } from '../api';
import { formatEur } from './format';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';
import {
  allocationFieldLabel,
  formatPlanMatrixAmount,
  resolveInvestmentTypeFromGroupKey,
  typeLabel,
  type VesinvestDraft,
  type VesinvestGroupedMatrixSection,
} from './vesinvestPlanningModel';
import {
  VesinvestMatrixSurface,
  VesinvestProjectDetailsSurface,
  VesinvestRegisterSurface,
} from './vesinvestPlanningSections';
import {
  displayValidationProjectName,
  displayValidationProjectNote,
  displayValidationProjectSubtype,
} from './validationDisplayText';

type UpdateProject = (
  index: number,
  updater: (current: V2VesinvestProject) => V2VesinvestProject,
) => void;

export function VesinvestPlanningInvestmentWorkspace({
  t,
  draft,
  groups,
  groupedPlanMatrix,
  yearTotals,
  totalInvestments,
  lawInvestmentSummary,
  busy,
  loading,
  loadingPlan,
  openProjectComposer,
  updateProject,
  setDraft,
  updateProjectAllocation,
}: {
  t: TFunction;
  draft: VesinvestDraft;
  groups: V2VesinvestGroupDefinition[];
  groupedPlanMatrix: VesinvestGroupedMatrixSection[];
  yearTotals: Array<{ year: number; totalAmount: number }>;
  totalInvestments: number;
  lawInvestmentSummary: V2VesinvestPlan['lawInvestmentSummary'] | null;
  busy: boolean;
  loading: boolean;
  loadingPlan: boolean;
  openProjectComposer: () => void;
  updateProject: UpdateProject;
  setDraft: React.Dispatch<React.SetStateAction<VesinvestDraft>>;
  updateProjectAllocation: (
    projectIndex: number,
    year: number,
    fieldKey: 'totalAmount' | 'waterAmount' | 'wastewaterAmount',
    value: number,
  ) => void;
}) {
  const [allocationEditorProjectIndex, setAllocationEditorProjectIndex] =
    React.useState<number | null>(null);
  const allocationEditorProject =
    allocationEditorProjectIndex == null
      ? null
      : draft.projects[allocationEditorProjectIndex] ?? null;
  const allocationEditorTotals = React.useMemo(() => {
    if (!allocationEditorProject) {
      return { totalAmount: 0, waterAmount: 0, wastewaterAmount: 0 };
    }
    return allocationEditorProject.allocations.reduce(
      (sum, item) => ({
        totalAmount: sum.totalAmount + (item.totalAmount ?? 0),
        waterAmount: sum.waterAmount + (item.waterAmount ?? 0),
        wastewaterAmount: sum.wastewaterAmount + (item.wastewaterAmount ?? 0),
      }),
      { totalAmount: 0, waterAmount: 0, wastewaterAmount: 0 },
    );
  }, [allocationEditorProject]);
  const bucketLabel = (key: string) =>
    key === 'years_1_5' || key === 'years_0_5'
      ? t('v2Vesinvest.lawBucketYears05', 'Years 1-5')
      : key === 'years_6_10'
      ? t('v2Vesinvest.lawBucketYears610', 'Years 6-10')
      : key === 'years_11_20'
      ? t('v2Vesinvest.lawBucketYears1120', 'Years 11-20')
      : key;

  return (
    <>
      {lawInvestmentSummary ? (
        <VesinvestMatrixSurface t={t}>
          <div className="v2-section-heading">
            <span className="v2-eyebrow">
              {t('v2Vesinvest.lawInvestmentEyebrow', '20-year legal summary')}
            </span>
            <h3>{t('v2Vesinvest.lawInvestmentTitle', 'Investment need by law view')}</h3>
            <p>
              {t(
                'v2Vesinvest.lawInvestmentSummary',
                'Saved summary of renovation, new investments, asset categories, and tariff-relevant timing.',
              )}
            </p>
          </div>
          <div className="v2-grid v2-grid-3">
            <div className="v2-stat-card">
              <span>{t('v2Vesinvest.lawRenovationAmount', 'Renovation')}</span>
              <strong>{formatEur(lawInvestmentSummary.renovationAmount)}</strong>
            </div>
            <div className="v2-stat-card">
              <span>{t('v2Vesinvest.lawNewInvestmentAmount', 'New investments')}</span>
              <strong>{formatEur(lawInvestmentSummary.newInvestmentAmount)}</strong>
            </div>
            <div className="v2-stat-card">
              <span>{t('v2Vesinvest.lawRepairAmount', 'Repairs')}</span>
              <strong>{formatEur(lawInvestmentSummary.repairAmount)}</strong>
            </div>
          </div>
          <div className="v2-vesinvest-table-wrap">
            <table className="v2-vesinvest-table">
              <thead>
                <tr>
                  <th>{t('v2Vesinvest.lawTimeBucket', 'Time bucket')}</th>
                  <th>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</th>
                  <th>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</th>
                  <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {lawInvestmentSummary.timeBuckets.map((bucket) => (
                  <tr key={bucket.key}>
                    <td>
                      {bucketLabel(bucket.key)} ({bucket.startYear}-{bucket.endYear})
                    </td>
                    <td>{formatEur(bucket.waterAmount)}</td>
                    <td>{formatEur(bucket.wastewaterAmount)}</td>
                    <td>{formatEur(bucket.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="v2-vesinvest-table-wrap">
            <table className="v2-vesinvest-table">
              <thead>
                <tr>
                  <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                  <th>{t('v2Vesinvest.projectCount', 'Projects')}</th>
                  <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {lawInvestmentSummary.byAssetCategory.map((category) => (
                  <tr key={category.groupKey}>
                    <td>
                      {resolveVesinvestGroupLabel(
                        t,
                        category.groupKey,
                        category.groupLabel,
                      )}
                    </td>
                    <td>{category.projectCount}</td>
                    <td>{formatEur(category.totalAmount)}</td>
                  </tr>
                ))}
                {lawInvestmentSummary.byInvestmentType.map((item) => (
                  <tr key={item.investmentType}>
                    <td>{typeLabel(t, item.investmentType)}</td>
                    <td>{item.projectCount}</td>
                    <td>{formatEur(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VesinvestMatrixSurface>
      ) : null}

      <VesinvestMatrixSurface t={t}>
        <div className="v2-vesinvest-table-wrap v2-vesinvest-matrix-wrap" data-testid="vesinvest-grouped-plan">
          <table className="v2-vesinvest-table v2-vesinvest-plan-matrix">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                {draft.horizonYearsRange.map((year) => (
                  <th key={`matrix-head-${year}`}>{year}</th>
                ))}
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {groupedPlanMatrix.length === 0 ? (
                <tr>
                  <td colSpan={draft.horizonYearsRange.length + 3} className="v2-muted">
                    <div>
                      <span>
                        {t(
                          'v2Vesinvest.projectEmpty',
                          'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                        )}
                      </span>
                      <button
                        type="button"
                        className="v2-btn v2-btn-primary"
                        data-testid="vesinvest-empty-add-project"
                        onClick={openProjectComposer}
                        disabled={busy || loading || loadingPlan || groups.length === 0}
                      >
                        {t('v2Vesinvest.addProject', 'Add project')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {groupedPlanMatrix.map((section) => (
                <React.Fragment key={section.groupKey}>
                  <tr className="v2-vesinvest-matrix-group-row">
                    <td />
                    <td className="v2-vesinvest-matrix-label">{section.groupLabel}</td>
                    {section.yearlyTotals.map((item) => (
                      <td key={`${section.groupKey}-${item.year}`}>
                        {formatPlanMatrixAmount(item.totalAmount)}
                      </td>
                    ))}
                    <td>{formatPlanMatrixAmount(section.totalAmount)}</td>
                  </tr>
                  {section.projects.map((project) => (
                    <tr
                      key={`${section.groupKey}-${project.code}`}
                      className="v2-vesinvest-matrix-project-row"
                    >
                      <td>{project.code}</td>
                      <td>
                        {displayValidationProjectName(t, project.name) ||
                          t('v2Vesinvest.projectUnnamed', 'Unnamed project')}
                      </td>
                      {project.yearlyTotals.map((item) => (
                        <td key={`${project.code}-${item.year}`}>
                          {formatPlanMatrixAmount(item.totalAmount)}
                        </td>
                      ))}
                      <td>{formatPlanMatrixAmount(project.totalAmount)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {groupedPlanMatrix.length > 0 ? (
                <tr className="v2-vesinvest-matrix-total-row">
                  <td />
                  <td className="v2-vesinvest-matrix-label">
                    {t('v2Vesinvest.totalInvestments', 'Horizon total')}
                  </td>
                  {yearTotals.map((item) => (
                    <td key={`matrix-total-${item.year}`}>
                      {formatPlanMatrixAmount(item.totalAmount)}
                    </td>
                  ))}
                  <td>{formatPlanMatrixAmount(totalInvestments)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </VesinvestMatrixSurface>

      <VesinvestRegisterSurface t={t}>
        <div className="v2-vesinvest-table-wrap">
          <table className="v2-vesinvest-table v2-vesinvest-project-register-table">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                <th>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</th>
                <th>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</th>
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                <th>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="v2-muted">
                    {t(
                      'v2Vesinvest.projectEmpty',
                      'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                    )}
                  </td>
                </tr>
              ) : null}
              {draft.projects.map((project, index) => (
                <tr key={project.id ?? `draft-project-row-${index}`}>
                  <td>
                    <input
                      id={`vesinvest-project-code-${index}`}
                      name={`vesinvest-project-code-${index}`}
                      className="v2-input"
                      value={project.code}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      id={`vesinvest-project-name-${index}`}
                      name={`vesinvest-project-name-${index}`}
                      className="v2-input"
                      value={displayValidationProjectName(t, project.name)}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      id={`vesinvest-project-group-${index}`}
                      name={`vesinvest-project-group-${index}`}
                      className="v2-input"
                      value={project.groupKey}
                      onChange={(event) => {
                        const group = groups.find((item) => item.key === event.target.value);
                        updateProject(index, (current) => ({
                          ...current,
                          groupKey: event.target.value,
                          groupLabel: group?.label,
                          investmentType: resolveInvestmentTypeFromGroupKey(event.target.value),
                          depreciationClassKey: group?.defaultDepreciationClassKey ?? group?.key ?? null,
                          defaultAccountKey: group?.defaultAccountKey ?? null,
                          reportGroupKey: group?.reportGroupKey ?? null,
                        }));
                      }}
                    >
                      {groups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {resolveVesinvestGroupLabel(t, group.key, group.label)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatEur(project.waterAmount ?? 0)}</td>
                  <td>{formatEur(project.wastewaterAmount ?? 0)}</td>
                  <td>{formatEur(project.totalAmount ?? 0)}</td>
                  <td>
                    <div className="v2-actions-row v2-vesinvest-row-actions">
                      <button
                        type="button"
                        className="v2-btn v2-btn-small"
                        onClick={() => setAllocationEditorProjectIndex(index)}
                      >
                        {t('v2Vesinvest.editYearlyAllocations', 'Edit yearly allocations')}
                      </button>
                      <button
                        type="button"
                        className="v2-btn v2-btn-small v2-btn-danger"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            projects: current.projects.filter((_, projectIndex) => projectIndex !== index),
                          }))
                        }
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VesinvestRegisterSurface>

      {draft.projects.length > 0 ? (
        <VesinvestProjectDetailsSurface>
          {draft.projects.map((project, projectIndex) => (
            <section
              key={project.id ?? `draft-project-details-${projectIndex}`}
              className="v2-vesinvest-project-card"
              data-vesinvest-project-index={projectIndex}
            >
              <div className="v2-section-header">
                <div>
                  <p className="v2-overview-eyebrow">{project.code}</p>
                  <h3>
                    {displayValidationProjectName(t, project.name) ||
                      t('v2Vesinvest.projectUnnamed', 'Unnamed project')}
                  </h3>
                  <p className="v2-muted">
                    {`${typeLabel(t, project.investmentType)} · ${resolveVesinvestGroupLabel(
                      t,
                      project.groupKey,
                      project.groupLabel,
                    )}`}
                  </p>
                </div>
                <div className="v2-overview-year-summary-grid v2-vesinvest-project-meta">
                  <div>
                    <span>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</span>
                    <strong>{formatEur(project.waterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</span>
                    <strong>{formatEur(project.wastewaterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectTotal', 'Total')}</span>
                    <strong>{formatEur(project.totalAmount ?? 0)}</strong>
                  </div>
                </div>
              </div>
              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>{t('v2Vesinvest.projectSubtype', 'Subtype')}</span>
                  <input
                    id={`vesinvest-project-subtype-${projectIndex}`}
                    name={`vesinvest-project-subtype-${projectIndex}`}
                    className="v2-input"
                    value={displayValidationProjectSubtype(t, project.subtype)}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        subtype: event.target.value || null,
                      }))
                    }
                  />
                </label>
                <label className="v2-field v2-field-wide">
                  <span>{t('v2Vesinvest.projectNotes', 'Notes')}</span>
                  <input
                    id={`vesinvest-project-notes-${projectIndex}`}
                    name={`vesinvest-project-notes-${projectIndex}`}
                    className="v2-input"
                    value={displayValidationProjectNote(t, project.notes)}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        notes: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="v2-actions-row">
                <button
                  type="button"
                  className="v2-btn"
                  onClick={() => setAllocationEditorProjectIndex(projectIndex)}
                >
                  {t('v2Vesinvest.editYearlyAllocations', 'Edit yearly allocations')}
                </button>
              </div>
            </section>
          ))}
        </VesinvestProjectDetailsSurface>
      ) : null}

      {allocationEditorProject && allocationEditorProjectIndex != null ? (
        <div
          className="v2-modal-backdrop"
          onClick={() => setAllocationEditorProjectIndex(null)}
        >
          <div
            className="v2-modal-card v2-vesinvest-allocation-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vesinvest-allocation-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="v2-section-header">
              <div>
                <p className="v2-overview-eyebrow">{allocationEditorProject.code}</p>
                <h3 id="vesinvest-allocation-editor-title">
                  {t('v2Vesinvest.editYearlyAllocations', 'Edit yearly allocations')}
                </h3>
                <p className="v2-muted">
                  {displayValidationProjectName(t, allocationEditorProject.name) ||
                    t('v2Vesinvest.projectUnnamed', 'Unnamed project')}
                </p>
              </div>
              <button
                type="button"
                className="v2-btn"
                onClick={() => setAllocationEditorProjectIndex(null)}
              >
                {t('common.close', 'Close')}
              </button>
            </div>

            <div className="v2-overview-year-summary-grid v2-vesinvest-allocation-totals">
              <div>
                <span>{t('v2Vesinvest.projectTotal', 'Total')}</span>
                <strong>{formatEur(allocationEditorTotals.totalAmount)}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</span>
                <strong>{formatEur(allocationEditorTotals.waterAmount)}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</span>
                <strong>{formatEur(allocationEditorTotals.wastewaterAmount)}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.fundedYears', 'Funded years')}</span>
                <strong>
                  {allocationEditorProject.allocations
                    .filter(
                      (allocation) =>
                        allocation.totalAmount > 0 ||
                        allocation.waterAmount > 0 ||
                        allocation.wastewaterAmount > 0,
                    )
                    .map((allocation) => allocation.year)
                    .join(', ') || t('v2Vesinvest.none', 'None')}
                </strong>
              </div>
            </div>

            <div className="v2-vesinvest-table-wrap v2-vesinvest-allocation-editor-wrap">
              <table className="v2-vesinvest-table v2-vesinvest-allocation-editor-table">
                <thead>
                  <tr>
                    <th>{t('common.year', 'Year')}</th>
                    <th>{allocationFieldLabel(t, 'totalAmount')}</th>
                    <th>{allocationFieldLabel(t, 'waterAmount')}</th>
                    <th>{allocationFieldLabel(t, 'wastewaterAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.horizonYearsRange.map((year) => {
                    const allocation =
                      allocationEditorProject.allocations.find((item) => item.year === year) ??
                      null;
                    return (
                      <tr key={`${allocationEditorProject.code}-${year}`}>
                        <td>{year}</td>
                        {(['totalAmount', 'waterAmount', 'wastewaterAmount'] as const).map(
                          (fieldKey) => (
                            <td key={`${allocationEditorProject.code}-${year}-${fieldKey}`}>
                              <input
                                id={`vesinvest-allocation-${allocationEditorProjectIndex}-${fieldKey}-${year}`}
                                name={`vesinvest-allocation-${allocationEditorProjectIndex}-${fieldKey}-${year}`}
                                aria-label={`${allocationEditorProject.code} ${year} ${allocationFieldLabel(
                                  t,
                                  fieldKey,
                                )}`}
                                className="v2-input v2-number-input v2-vesinvest-allocation-input"
                                type="number"
                                min={0}
                                value={allocation?.[fieldKey] ?? 0}
                                onChange={(event) =>
                                  updateProjectAllocation(
                                    allocationEditorProjectIndex,
                                    year,
                                    fieldKey,
                                    Number(event.target.value || 0),
                                  )
                                }
                              />
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
