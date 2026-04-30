import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewImportBoard } from './OverviewImportBoard';

const t = ((key: string, fallback?: unknown) =>
  typeof fallback === 'string' ? fallback : key) as any;

const readyRow = {
  vuosi: 2024,
  completeness: {
    tilinpaatos: true,
    taksa: true,
    tariff_revenue: true,
    volume_vesi: true,
    volume_jatevesi: true,
  },
  missingRequirements: [],
  summaryMap: new Map(),
  trustToneClass: 'v2-status-positive',
  trustLabel: 'Ready',
  sourceStatus: 'VEETI',
  warnings: [],
  resultToZero: { direction: 'balanced', effectiveValue: 0, marginPct: 0 },
  trustNote: null,
  sourceLayers: [],
  missingSummary: null,
} as any;

function renderBoard(overrides?: Partial<React.ComponentProps<typeof OverviewImportBoard>>) {
  return render(
    <OverviewImportBoard
      t={t}
      wizardBackLabel={null}
      onBack={() => undefined}
      selectedYears={[2024]}
      syncing={false}
      readyRows={[readyRow]}
      suspiciousRows={[]}
      blockedRows={[]}
      trashbinRows={[]}
      currentYearEstimateRows={[]}
      confirmedImportedYears={[]}
      yearDataCache={{}}
      cardEditYear={null}
      cardEditContext={null}
      cardEditFocusField={null}
      isAdmin={false}
      renderStep2InlineFieldEditor={() => null}
      buildRepairActions={() => []}
      sourceStatusLabel={() => 'VEETI'}
      sourceStatusClassName={() => 'v2-status-positive'}
      sourceLayerText={() => ''}
      renderDatasetCounts={() => ''}
      missingRequirementLabel={() => ''}
      attemptOpenInlineCardEditor={() => undefined}
      openInlineCardEditor={() => undefined}
      loadingYearData={null}
      manualPatchError={null}
      blockedYearCount={0}
      removingYear={null}
      onToggleYear={vi.fn()}
      onImportYears={vi.fn()}
      onAddCurrentYearEstimate={vi.fn()}
      onTrashYear={vi.fn()}
      onRestoreYear={vi.fn()}
      importYearsButtonClass="v2-btn v2-btn-primary"
      importingYears={false}
      {...overrides}
    />,
  );
}

describe('OverviewImportBoard role access', () => {
  it('keeps baseline import controls out of the non-admin review surface', () => {
    renderBoard();

    expect(
      screen.getByText(
        'Admin access is required to import, remove, or repair baseline years.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: '2024' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to trashbin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'v2Overview.importYearsButton' })).toBeNull();
  });
});
