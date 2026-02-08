import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listBudgets, getBudget, createBudget,
  createBudgetLine, updateBudgetLine, deleteBudgetLine,
  type Budget, type BudgetLine, type RevenueDriver,
} from '../api';
import { formatCurrency } from '../utils/format';
import { BudgetImport } from '../components/BudgetImport';
import { useNavigation } from '../context/NavigationContext';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

/** Per-driver revenue breakdown (same logic as RevenuePage). */
function driverRevenue(d: RevenueDriver | undefined): { usage: number; baseFee: number; total: number } {
  if (!d) return { usage: 0, baseFee: 0, total: 0 };
  const usage = parseFloat(d.yksikkohinta || '0') * parseFloat(d.myytyMaara || '0');
  const baseFee = (d.perusmaksu != null && d.liittymamaara != null)
    ? parseFloat(String(d.perusmaksu)) * d.liittymamaara
    : 0;
  return { usage, baseFee, total: usage + baseFee };
}

export const BudgetPage: React.FC = () => {
  const { t } = useTranslation();
  const { navigateToTab } = useNavigation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingType, setAddingType] = useState<'kulu' | 'tulo' | 'investointi' | null>(null);
  const [newLine, setNewLine] = useState({ tiliryhma: '', nimi: '', summa: '' });
  const [showImport, setShowImport] = useState(false);
  const [showVesimaksutBreakdown, setShowVesimaksutBreakdown] = useState(false);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await listBudgets();
      setBudgets(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
      return [];
    }
  }, []);

  const loadBudget = useCallback(async (id: string) => {
    try {
      const data = await getBudget(id);
      setActiveBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadBudgets();
      if (data.length > 0) {
        await loadBudget(data[0].id);
      }
      setLoading(false);
    })();
  }, [loadBudgets, loadBudget]);

  const handleEditRevenues = useCallback(() => {
    try {
      sessionStorage.setItem('scrollToRevenueDrivers', '1');
    } catch {
      /* ignore */
    }
    navigateToTab('revenue');
  }, [navigateToTab]);

  // Create budget for selected year
  const handleCreateBudget = async (year: number) => {
    try {
      const created = await createBudget({ vuosi: year });
      await loadBudgets();
      await loadBudget(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    }
  };

  // Inline edit: start
  const startEdit = (line: BudgetLine) => {
    setEditingLineId(line.id);
    setEditValue(String(parseFloat(line.summa)));
  };

  // Inline edit: save
  const saveEdit = async (line: BudgetLine) => {
    if (!activeBudget) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) return;
    try {
      await updateBudgetLine(activeBudget.id, line.id, { summa: val });
      await loadBudget(activeBudget.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line');
    }
    setEditingLineId(null);
  };

  // Add new line
  const handleAddLine = async () => {
    if (!activeBudget || !addingType) return;
    const summa = parseFloat(newLine.summa);
    if (!newLine.nimi || isNaN(summa)) return;
    try {
      await createBudgetLine(activeBudget.id, {
        tiliryhma: newLine.tiliryhma || '9999',
        nimi: newLine.nimi,
        tyyppi: addingType,
        summa,
      });
      await loadBudget(activeBudget.id);
      setAddingType(null);
      setNewLine({ tiliryhma: '', nimi: '', summa: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line');
    }
  };

  // Delete line
  const handleDeleteLine = async (lineId: string) => {
    if (!activeBudget) return;
    try {
      await deleteBudgetLine(activeBudget.id, lineId);
      await loadBudget(activeBudget.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line');
    }
  };

  // Group lines by type
  const lines = activeBudget?.rivit ?? [];
  const revenueLines = lines.filter((l) => l.tyyppi === 'tulo');
  const expenseLines = lines.filter((l) => l.tyyppi === 'kulu');
  const investmentLines = lines.filter((l) => l.tyyppi === 'investointi');

  // Compute revenue from drivers
  const drivers = activeBudget?.tuloajurit ?? [];
  const computedRevenue = drivers.reduce((sum, d) => {
    return sum + parseFloat(d.yksikkohinta) * parseFloat(d.myytyMaara)
      + (d.perusmaksu && d.liittymamaara ? parseFloat(d.perusmaksu) * d.liittymamaara : 0);
  }, 0);

  const totalRevenue = revenueLines.reduce((s, l) => s + parseFloat(l.summa), 0) + computedRevenue;
  const totalExpenses = expenseLines.reduce((s, l) => s + parseFloat(l.summa), 0);
  const totalInvestments = investmentLines.reduce((s, l) => s + parseFloat(l.summa), 0);
  const netResult = totalRevenue - totalExpenses - totalInvestments;

  // Loading state
  if (loading) {
    return <div className="budget-page"><p>{t('common.loading')}</p></div>;
  }

  // No budgets — show create prompt
  if (budgets.length === 0 && !activeBudget) {
    return (
      <div className="budget-page">
        <div className="page-header"><h2>{t('budget.title')}</h2></div>
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>{t('budget.noData')}</h3>
          <p>{t('budget.noDataHint')}</p>
          <button className="btn btn-primary" onClick={() => handleCreateBudget(currentYear)}>
            {t('budget.createNew')} {currentYear}
          </button>
        </div>
      </div>
    );
  }

  const renderLineRow = (line: BudgetLine, isComputed = false) => (
    <tr key={line.id} className="budget-line-row">
      <td className="line-code">{line.tiliryhma}</td>
      <td className="line-name">{line.nimi}{isComputed && <span className="computed-badge">({t('common.computed')})</span>}</td>
      <td className="line-amount num">
        {editingLineId === line.id ? (
          <input
            type="number"
            className="inline-edit"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(line)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(line); if (e.key === 'Escape') setEditingLineId(null); }}
            autoFocus
          />
        ) : (
          <span className="editable-amount" onClick={() => !isComputed && startEdit(line)}>
            {formatCurrency(line.summa)}
          </span>
        )}
      </td>
      <td className="line-actions">
        {!isComputed && (
          <button className="btn-icon" onClick={() => handleDeleteLine(line.id)} title={t('common.delete')}>×</button>
        )}
      </td>
    </tr>
  );

  const waterDriver = drivers.find((d) => d.palvelutyyppi === 'vesi');
  const wastewaterDriver = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
  const waterRev = driverRevenue(waterDriver);
  const wastewaterRev = driverRevenue(wastewaterDriver);
  const breakdownTotal = waterRev.total + wastewaterRev.total;

  const renderSection = (title: string, sectionLines: BudgetLine[], sectionTotal: number, type: 'kulu' | 'tulo' | 'investointi') => (
    <div className="budget-section">
      <h3 className="section-title">{title}</h3>
      <table className="budget-table">
        <tbody>
          {type === 'tulo' && computedRevenue > 0 && (
            <>
              <tr className="budget-line-row computed-row">
                <td className="line-code">3000</td>
                <td className="line-name">
                  {t('accountGroups.3000')} <span className="computed-badge">({t('common.computed')})</span>
                  <button
                    type="button"
                    className="btn-vesimaksut-info"
                    onClick={() => setShowVesimaksutBreakdown((v) => !v)}
                    title={showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                    aria-expanded={showVesimaksutBreakdown}
                  >
                    {showVesimaksutBreakdown ? '▼' : '▶'} {showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                  </button>
                </td>
                <td className="line-amount num">{formatCurrency(computedRevenue)}</td>
                <td className="line-actions"></td>
              </tr>
              {showVesimaksutBreakdown && (
                <tr className="vesimaksut-breakdown-row">
                  <td colSpan={4} className="vesimaksut-breakdown-cell">
                    <div className="vesimaksut-breakdown-panel">
                      <p className="vesimaksut-formula">{t('budget.vesimaksutFormula')}</p>
                      <table className="vesimaksut-breakdown-table">
                        <tbody>
                          {waterDriver && (waterRev.usage > 0 || waterRev.baseFee > 0) && (
                            <>
                              <tr>
                                <td>{t('revenue.water.title')}</td>
                                <td className="num">{formatCurrency(waterRev.usage)}</td>
                              </tr>
                              {waterRev.baseFee > 0 && (
                                <tr>
                                  <td>{t('revenue.water.baseFeeRevenue')}</td>
                                  <td className="num">{formatCurrency(waterRev.baseFee)}</td>
                                </tr>
                              )}
                            </>
                          )}
                          {wastewaterDriver && (wastewaterRev.usage > 0 || wastewaterRev.baseFee > 0) && (
                            <>
                              <tr>
                                <td>{t('revenue.wastewater.title')}</td>
                                <td className="num">{formatCurrency(wastewaterRev.usage)}</td>
                              </tr>
                              {wastewaterRev.baseFee > 0 && (
                                <tr>
                                  <td>{t('revenue.wastewater.baseFeeRevenue')}</td>
                                  <td className="num">{formatCurrency(wastewaterRev.baseFee)}</td>
                                </tr>
                              )}
                            </>
                          )}
                          <tr className="vesimaksut-breakdown-total">
                            <td>{t('revenue.totalRevenue')} ({t('budget.breakdownExclVat')})</td>
                            <td className="num"><strong>{formatCurrency(breakdownTotal)}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="vesimaksut-actions">
                        <button type="button" className="btn btn-small btn-primary" onClick={handleEditRevenues}>
                          {t('budget.editRevenues')}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          )}
          {sectionLines.map((l) => renderLineRow(l))}
        </tbody>
        <tfoot>
          <tr className="section-total">
            <td></td>
            <td>{t('common.total')}</td>
            <td className="num"><strong>{formatCurrency(type === 'tulo' ? totalRevenue : sectionTotal)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      {addingType === type ? (
        <div className="add-line-form">
          <input placeholder={t('budget.accountGroup')} value={newLine.tiliryhma} onChange={(e) => setNewLine((p) => ({ ...p, tiliryhma: e.target.value }))} className="input-sm" />
          <input placeholder={t('budget.name')} value={newLine.nimi} onChange={(e) => setNewLine((p) => ({ ...p, nimi: e.target.value }))} className="input-sm input-wide" />
          <input placeholder={t('budget.amount')} type="number" value={newLine.summa} onChange={(e) => setNewLine((p) => ({ ...p, summa: e.target.value }))} className="input-sm" />
          <button className="btn btn-small btn-primary" onClick={handleAddLine}>{t('common.add')}</button>
          <button className="btn btn-small" onClick={() => setAddingType(null)}>{t('common.cancel')}</button>
        </div>
      ) : (
        <button className="btn btn-ghost add-line-btn" onClick={() => setAddingType(type)}>+ {t('budget.addLine')}</button>
      )}
    </div>
  );

  return (
    <div className="budget-page">
      {error && (
        <div className="error-banner"><span>⚠ {error}</span><button className="btn btn-small" onClick={() => setError(null)}>{t('common.close')}</button></div>
      )}
      <div className="page-header">
        <div className="page-header-left">
          <h2>{t('budget.title')}</h2>
          <select
            className="filter-select year-select"
            value={activeBudget?.id ?? ''}
            onChange={async (e) => {
              if (e.target.value === '__new__') {
                const year = prompt(t('budget.selectYear'), String(currentYear + 1));
                if (year) await handleCreateBudget(parseInt(year));
              } else {
                await loadBudget(e.target.value);
              }
            }}
          >
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>{b.nimi || `${t('budget.title')} ${b.vuosi}`}</option>
            ))}
            <option value="__new__">+ {t('budget.createNew')}</option>
          </select>
          {activeBudget && (
            <span className={`status-badge status-${activeBudget.tila}`}>
              {activeBudget.tila === 'luonnos' ? t('budget.status.draft') : t('budget.status.confirmed')}
            </span>
          )}
        </div>
        {activeBudget && (
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            📁 {t('import.importButton')}
          </button>
        )}
      </div>

      {/* Budget Import Overlay */}
      {showImport && activeBudget && (
        <BudgetImport
          budgetId={activeBudget.id}
          onImportComplete={() => loadBudget(activeBudget.id)}
          onClose={() => setShowImport(false)}
        />
      )}

      {activeBudget && (
        <>
          {renderSection(t('budget.sections.revenue'), revenueLines, totalRevenue, 'tulo')}
          {renderSection(t('budget.sections.expenses'), expenseLines, totalExpenses, 'kulu')}
          {renderSection(t('budget.sections.investments'), investmentLines, totalInvestments, 'investointi')}

          <div className="budget-result">
            <span className="result-label">{t('budget.result')}</span>
            <span className={`result-value ${netResult >= 0 ? 'surplus' : 'deficit'}`}>
              {formatCurrency(Math.abs(netResult))} {netResult >= 0 ? t('common.surplus') : t('common.deficit')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
