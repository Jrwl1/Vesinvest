import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RevenueDriversPanel } from '../../components/RevenueDriversPanel';
import type { Budget, RevenueDriver } from '../../api';

/** Get the first tuloajurit-panel (React Strict Mode may double-mount). */
function getPanel(container: HTMLElement) {
  return container.querySelector('.tuloajurit-panel');
}

const mockT = (key: string, fallback?: string) => fallback ?? key;

function noop() {}

/** Minimal Budget with tuloajurit for Case A: vesi + jatevesi with given values. */
function budgetWithDrivers(tuloajurit: RevenueDriver[]): Budget {
  return {
    id: 'b1',
    orgId: 'org1',
    vuosi: 2024,
    nimi: 'KVA 2024',
    tila: 'luonnos',
    createdAt: '',
    updatedAt: '',
    tuloajurit,
  };
}

/** Vesi driver: yksikkohinta=1.23, myytyMaara=12000, liittymamaara=500, perusmaksu=30, alvProsentti=25.5 */
const vesiDriver: RevenueDriver = {
  id: 'd-vesi',
  talousarvioId: 'b1',
  palvelutyyppi: 'vesi',
  yksikkohinta: '1.23',
  myytyMaara: '12000',
  perusmaksu: '30',
  liittymamaara: 500,
  alvProsentti: '25.5',
  muistiinpanot: null,
  createdAt: '',
  updatedAt: '',
};

/** Jätevesi driver: yksikkohinta=2.34, myytyMaara=8000, liittymamaara=450, perusmaksu=25, alvProsentti=25.5 */
const jatevesiDriver: RevenueDriver = {
  id: 'd-jatevesi',
  talousarvioId: 'b1',
  palvelutyyppi: 'jatevesi',
  yksikkohinta: '2.34',
  myytyMaara: '8000',
  perusmaksu: '25',
  liittymamaara: 450,
  alvProsentti: '25.5',
  muistiinpanot: null,
  createdAt: '',
  updatedAt: '',
};

/**
 * Tulot drivers panel must reflect activeBudget.tuloajurit.
 * If Case A fails: panel is not showing driver values (wrong data source, wrong field name, or value not passed down).
 * When fixed: Case A should assert the inputs show the values below (not '-' or 0 unless actually 0).
 */
describe('RevenueDriversPanel (Tulot tuloajurit)', () => {
  describe('Case A: budget has tuloajurit for vesi and jatevesi', () => {
    it('shows driver values in inputs (not "-" or 0 unless actually 0)', () => {
      const budget = budgetWithDrivers([vesiDriver, jatevesiDriver]);
      const { container } = render(
        <RevenueDriversPanel
          budget={budget}
          savingDriverType={null}
          driverFieldErrors={{}}
          updateDriverField={noop}
          saveDriver={noop}
          setDriverFieldErrors={noop}
          t={mockT}
        />,
      );

      const panel = getPanel(container);
      expect(panel).toBeTruthy();
      const inputs = within(panel as HTMLElement).getAllByRole('textbox');
      expect(inputs).toHaveLength(8);

      // Required: inputs must show these values from budget.tuloajurit (not placeholder '-' or 0)
      // Order: vesi unit, vesi volume, vesi connections, vesi base fee, jatevesi unit, jatevesi volume, jatevesi connections, jatevesi base fee
      expect((inputs[0] as HTMLInputElement).value).toBe('1.23');
      expect((inputs[1] as HTMLInputElement).value).toBe('12000');
      expect((inputs[2] as HTMLInputElement).value).toBe('500');
      expect((inputs[3] as HTMLInputElement).value).toBe('30');

      expect((inputs[4] as HTMLInputElement).value).toBe('2.34');
      expect((inputs[5] as HTMLInputElement).value).toBe('8000');
      expect((inputs[6] as HTMLInputElement).value).toBe('450');
      expect((inputs[7] as HTMLInputElement).value).toBe('25');
    });
  });

  describe('Case B: budget has empty tuloajurit', () => {
    it('shows placeholder "-" in inputs and panel still renders', () => {
      const budget = budgetWithDrivers([]);
      const { container } = render(
        <RevenueDriversPanel
          budget={budget}
          savingDriverType={null}
          driverFieldErrors={{}}
          updateDriverField={noop}
          saveDriver={noop}
          setDriverFieldErrors={noop}
          t={mockT}
        />,
      );

      const panel = getPanel(container);
      expect(panel).toBeTruthy();
      const inputs = within(panel as HTMLElement).getAllByRole('textbox');
      expect(inputs).toHaveLength(8);

      for (let i = 0; i < 8; i++) {
        const input = inputs[i] as HTMLInputElement;
        expect(input.placeholder).toBe('–');
        expect(input.value).toBe('');
      }
    });
  });
});
