import React from 'react';
import type { TFunction } from 'i18next';

import type { V2VesinvestGroupDefinition, V2VesinvestProject } from '../api';
import { formatEur } from './format';
import {
  allocationFieldLabel,
  formatPlanMatrixAmount,
  resolveInvestmentTypeFromGroupKey,
  type VesinvestDraft,
  type VesinvestGroupedMatrixSection,
  typeLabel,
} from './vesinvestPlanningModel';
import {
  VesinvestMatrixSurface,
  VesinvestProjectDetailsSurface,
  VesinvestRegisterSurface,
} from './vesinvestPlanningSections';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

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
  return (
    <>
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
                      <td>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</td>
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
          <table className="v2-vesinvest-table">
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
                      value={project.name}
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
                  <h3>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</h3>
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
                    value={project.subtype ?? ''}
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
                    value={project.notes ?? ''}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        notes: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="v2-vesinvest-table-wrap">
                <table className="v2-vesinvest-table v2-vesinvest-allocation-table">
                  <thead>
                    <tr>
                      <th>{t('v2Vesinvest.allocationMetric', 'Split')}</th>
                      {draft.horizonYearsRange.map((year) => (
                        <th key={year}>{year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['totalAmount', 'waterAmount', 'wastewaterAmount'] as const).map((fieldKey) => (
                      <tr key={`${project.code}-${fieldKey}`}>
                        <td>{allocationFieldLabel(t, fieldKey)}</td>
                        {draft.horizonYearsRange.map((year) => {
                          const allocation = project.allocations.find((item) => item.year === year) ?? null;
                          return (
                            <td key={`${project.code}-${fieldKey}-${year}`}>
                              <input
                                id={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                name={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                aria-label={`${project.code} ${year} ${allocationFieldLabel(
                                  t,
                                  fieldKey,
                                )}`}
                                className="v2-input"
                                type="number"
                                min={0}
                                value={allocation?.[fieldKey] ?? 0}
                                onChange={(event) =>
                                  updateProjectAllocation(
                                    projectIndex,
                                    year,
                                    fieldKey,
                                    Number(event.target.value || 0),
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </VesinvestProjectDetailsSurface>
      ) : null}
    </>
  );
}
