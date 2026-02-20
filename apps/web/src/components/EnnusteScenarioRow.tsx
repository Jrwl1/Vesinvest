import React from 'react';
import type { Projection } from '../api';

type EnnusteScenarioRowProps = {
  projections: Projection[];
  activeProjectionId: string | null;
  onSelectProjection: (projectionId: string) => void;
  onCreateScenario: () => void;
  onDeleteScenario?: () => void;
  scenarioAriaLabel: string;
  createScenarioLabel: string;
  deleteScenarioLabel: string;
  deleteScenarioAriaLabel?: string;
};

export const EnnusteScenarioRow: React.FC<EnnusteScenarioRowProps> = ({
  projections,
  activeProjectionId,
  onSelectProjection,
  onCreateScenario,
  onDeleteScenario,
  scenarioAriaLabel,
  createScenarioLabel,
  deleteScenarioLabel,
  deleteScenarioAriaLabel,
}) => {
  if (projections.length === 0) return null;

  return (
    <nav className="ennuste-scenarios" aria-label={scenarioAriaLabel}>
      {projections.map((projection) => (
        <button
          key={projection.id}
          type="button"
          data-testid={`projection-scenario-pill-${projection.id}`}
          className={`ennuste-pill ${activeProjectionId === projection.id ? 'active' : ''}`}
          aria-pressed={activeProjectionId === projection.id}
          onClick={() => onSelectProjection(projection.id)}
        >
          {projection.nimi}
          {projection.onOletus && ' *'}
        </button>
      ))}
      <button
        type="button"
        className="ennuste-btn ennuste-btn-primary"
        data-testid="projection-create-scenario-btn"
        onClick={onCreateScenario}
      >
        {createScenarioLabel}
      </button>
      {onDeleteScenario && (
        <button
          type="button"
          className="ennuste-btn btn-danger-text"
          onClick={onDeleteScenario}
          title={deleteScenarioLabel}
          aria-label={deleteScenarioAriaLabel}
        >
          &times; {deleteScenarioLabel}
        </button>
      )}
    </nav>
  );
};
