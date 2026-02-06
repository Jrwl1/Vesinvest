import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listProjections,
  getProjection,
  computeProjection,
  type Projection,
  type ProjectionYear,
} from '../api';

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function fmtEur(n: number): string {
  return n.toLocaleString('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

interface CompareScenario {
  projection: Projection;
  years: ProjectionYear[];
  color: string;
}

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

interface ScenarioComparisonProps {
  onClose: () => void;
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [allProjections, setAllProjections] = useState<Projection[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<CompareScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    listProjections().then((list) => {
      setAllProjections(list);
      // Auto-select all (up to 4)
      setSelectedIds(list.slice(0, 4).map((p) => p.id));
      setLoading(false);
    });
  }, []);

  const handleCompare = async () => {
    if (selectedIds.length < 2) return;
    setComputing(true);

    try {
      const results: CompareScenario[] = [];
      for (let i = 0; i < selectedIds.length; i++) {
        // Ensure computed
        let proj = await getProjection(selectedIds[i]);
        if (!proj.vuodet || proj.vuodet.length === 0) {
          proj = await computeProjection(selectedIds[i]);
        }
        results.push({
          projection: proj,
          years: proj.vuodet ?? [],
          color: COLORS[i % COLORS.length],
        });
      }
      setScenarios(results);
    } catch (e) {
      // Error handling is minimal here
    } finally {
      setComputing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Get all unique years across scenarios
  const allYears = [...new Set(scenarios.flatMap((s) => s.years.map((y) => y.vuosi)))].sort();

  const getYear = (scenario: CompareScenario, vuosi: number): ProjectionYear | undefined => {
    return scenario.years.find((y) => y.vuosi === vuosi);
  };

  return (
    <div className="scenario-comparison">
      <div className="comparison-header">
        <h3>{t('projection.comparing')}</h3>
        <button className="btn-secondary" onClick={onClose}>{t('common.close')}</button>
      </div>

      {/* Scenario picker */}
      {scenarios.length === 0 && (
        <div className="comparison-picker card">
          <p>{t('projection.scenarios')}:</p>
          <div className="scenario-checkboxes">
            {allProjections.map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelection(p.id)}
                />
                {p.nimi}
                {p.talousarvio && ` (${p.talousarvio.vuosi})`}
              </label>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || computing}
          >
            {computing ? t('projection.computing') : t('projection.compare')} ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Comparison table */}
      {scenarios.length >= 2 && (
        <div className="comparison-table-wrapper card">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>{t('projection.columns.year')}</th>
                {scenarios.map((s) => (
                  <th key={s.projection.id} colSpan={2} style={{ borderBottom: `3px solid ${s.color}` }}>
                    {s.projection.nimi}
                  </th>
                ))}
              </tr>
              <tr className="sub-header">
                <th></th>
                {scenarios.map((s) => (
                  <React.Fragment key={s.projection.id}>
                    <th className="num-col">{t('projection.columns.netResult')}</th>
                    <th className="num-col">{t('projection.columns.cumulative')}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {allYears.map((vuosi) => (
                <tr key={vuosi}>
                  <td className="year-cell">{vuosi}</td>
                  {scenarios.map((s) => {
                    const y = getYear(s, vuosi);
                    const tulos = y ? num(y.tulos) : 0;
                    const kum = y ? num(y.kumulatiivinenTulos) : 0;
                    return (
                      <React.Fragment key={s.projection.id}>
                        <td className={`num-col ${tulos >= 0 ? 'positive' : 'negative'}`}>
                          {y ? fmtEur(tulos) : '—'}
                        </td>
                        <td className={`num-col ${kum >= 0 ? 'positive' : 'negative'}`}>
                          {y ? fmtEur(kum) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="summary-row">
                <td><strong>{t('common.total')}</strong></td>
                {scenarios.map((s) => {
                  const totalResult = s.years.reduce((sum, y) => sum + num(y.tulos), 0);
                  const finalCum = s.years.length > 0 ? num(s.years[s.years.length - 1].kumulatiivinenTulos) : 0;
                  return (
                    <React.Fragment key={s.projection.id}>
                      <td className={`num-col ${totalResult >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{fmtEur(totalResult / (s.years.length || 1))}</strong>
                        <br /><small>{t('projection.summary.avgResult')}</small>
                      </td>
                      <td className={`num-col ${finalCum >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{fmtEur(finalCum)}</strong>
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tfoot>
          </table>

          {/* Legend */}
          <div className="comparison-legend">
            {scenarios.map((s) => {
              const deficitYears = s.years.filter((y) => num(y.tulos) < 0).length;
              return (
                <div key={s.projection.id} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: s.color }}></span>
                  <span className="legend-name">{s.projection.nimi}</span>
                  <span className="legend-info">
                    {deficitYears > 0
                      ? `${deficitYears} ${t('projection.summary.deficitYears').toLowerCase()}`
                      : t('projection.verdict.sustainable')
                    }
                  </span>
                </div>
              );
            })}
          </div>

          <button className="btn-secondary" onClick={() => setScenarios([])}>
            ← {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
};
