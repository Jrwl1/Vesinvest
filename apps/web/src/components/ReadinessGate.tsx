import React, { useState, useEffect, useCallback } from 'react';
import { checkReadiness, executePreview, executeImport } from '../api';
import type {
  ReadinessCheckResult,
  ImportExecutionResult,
  ImportAssumption,
  FieldCriticality,
  MatchKeyStrategy,
} from '../types';

interface ReadinessGateProps {
  importId: string;
  sheetId: string;
  mappingId: string;
  mappingName: string;
  onExecute: (result: ImportExecutionResult) => void;
  onBack: () => void;
}

export const ReadinessGate: React.FC<ReadinessGateProps> = ({
  importId,
  sheetId,
  mappingId,
  mappingName,
  onExecute,
  onBack,
}) => {
  const [readiness, setReadiness] = useState<ReadinessCheckResult | null>(null);
  const [preview, setPreview] = useState<ImportExecutionResult | null>(null);
  const [assumptions, setAssumptions] = useState<ImportAssumption[]>([]);
  // Per Asset Identity Contract, default to externalRef matching
  const [matchKeyStrategy, setMatchKeyStrategy] = useState<MatchKeyStrategy>('externalRef');
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'readiness' | 'preview' | 'execute'>('readiness');

  const loadReadiness = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await checkReadiness(importId, mappingId, sheetId, assumptions);
      setReadiness(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check readiness');
    } finally {
      setLoading(false);
    }
  }, [importId, mappingId, sheetId, assumptions]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const handleAddAssumption = (field: string) => {
    if (!assumptions.find((a) => a.field === field)) {
      setAssumptions([...assumptions, { field, value: '', reason: '' }]);
    }
  };

  const handleUpdateAssumption = (field: string, value: string, reason?: string) => {
    setAssumptions(
      assumptions.map((a) => (a.field === field ? { ...a, value, reason } : a))
    );
  };

  const handleRemoveAssumption = (field: string) => {
    setAssumptions(assumptions.filter((a) => a.field !== field));
  };

  const handleLoadPreview = async () => {
    try {
      setPreviewLoading(true);
      setError(null);
      const result = await executePreview(importId, mappingId, sheetId, matchKeyStrategy);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      const result = await executeImport(importId, mappingId, sheetId, {
        dryRun: false,
        matchKeyStrategy,
      });
      onExecute(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setExecuting(false);
    }
  };

  const getCriticalityClass = (criticality: FieldCriticality) => {
    switch (criticality) {
      case 'law_critical':
        return 'criticality-law';
      case 'model_critical':
        return 'criticality-model';
      default:
        return 'criticality-optional';
    }
  };

  if (loading) {
    return (
      <div className="readiness-gate">
        <div className="loading-spinner">Checking import readiness...</div>
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className="readiness-gate">
        <div className="error-banner">
          <span>{error || 'Failed to load readiness check'}</span>
          <button onClick={loadReadiness} className="btn btn-small">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="readiness-gate">
      <div className="readiness-header">
        <h3>Import Readiness Check</h3>
        <p className="mapping-info">Using mapping: <strong>{mappingName}</strong></p>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-small">
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Readiness Check */}
      {step === 'readiness' && (
        <>
          {/* Summary Cards */}
          <div className="readiness-summary">
            <div className={`summary-card ${readiness.canProceed ? 'success' : 'error'}`}>
              <div className="summary-label">Law-Critical Fields</div>
              <div className="summary-value">
                {readiness.summary.lawCriticalMapped} / {readiness.summary.lawCriticalCount}
              </div>
              {!readiness.canProceed && (
                <div className="summary-status">Missing required fields!</div>
              )}
            </div>
            <div className={`summary-card ${readiness.modelCriticalMissing.length === 0 ? 'success' : 'warning'}`}>
              <div className="summary-label">Model-Critical Fields</div>
              <div className="summary-value">
                {readiness.summary.modelCriticalMapped} / {readiness.summary.modelCriticalCount}
              </div>
              {readiness.modelCriticalMissing.length > 0 && (
                <div className="summary-status">
                  {readiness.modelCriticalMissing.length} can use assumptions
                </div>
              )}
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Mapped</div>
              <div className="summary-value">
                {readiness.summary.mappedFields} / {readiness.summary.totalFields}
              </div>
            </div>
          </div>

          {/* Errors */}
          {readiness.errors.length > 0 && (
            <div className="readiness-errors">
              <h4>Blocking Issues</h4>
              <ul>
                {readiness.errors.map((err, idx) => (
                  <li key={idx} className="error-item">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {readiness.warnings.length > 0 && (
            <div className="readiness-warnings">
              <h4>Warnings</h4>
              <ul>
                {readiness.warnings.map((warn, idx) => (
                  <li key={idx} className="warning-item">{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Field Coverage - Grouped by Category */}
          <div className="field-coverage">
            {/* Required from Excel */}
            {readiness.fieldCoverage.filter(f => f.requirementCategory === 'required_from_excel').length > 0 && (
              <div className="coverage-section">
                <h4 className="section-title section-required">
                  Required from Excel
                  <span className="section-hint">These fields must be mapped to columns in your spreadsheet</span>
                </h4>
                <table className="coverage-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Status</th>
                      <th>Excel Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.fieldCoverage
                      .filter(f => f.requirementCategory === 'required_from_excel')
                      .map((field) => (
                        <tr key={field.field} className={field.isMapped ? 'covered' : 'missing'}>
                          <td>
                            <strong>{field.label}</strong>
                            <span className="field-type">({field.type})</span>
                          </td>
                          <td>
                            {field.isMapped ? (
                              <span className="status-mapped">✓ Mapped</span>
                            ) : (
                              <span className="status-missing">✗ Missing</span>
                            )}
                          </td>
                          <td>
                            {field.isMapped ? (
                              <code>{field.mappedFrom}</code>
                            ) : (
                              <span className="not-mapped">Not mapped</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Can Use Assumptions */}
            {readiness.fieldCoverage.filter(f => f.requirementCategory === 'required_as_assumption').length > 0 && (
              <div className="coverage-section">
                <h4 className="section-title section-assumption">
                  Can Use Default Values
                  <span className="section-hint">Map from Excel if available, or set a default for all assets</span>
                </h4>
                <table className="coverage-table assumption-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Status</th>
                      <th>Value</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.fieldCoverage
                      .filter(f => f.requirementCategory === 'required_as_assumption')
                      .map((field) => (
                        <tr key={field.field} className={field.isMapped || field.hasAssumption ? 'covered' : 'needs-default'}>
                          <td>
                            <strong>{field.label}</strong>
                            <span className="field-type">({field.type})</span>
                            {field.defaultAssumption && (
                              <span className="default-hint">Default: {field.defaultAssumption}</span>
                            )}
                          </td>
                          <td>
                            {field.isMapped ? (
                              <span className="status-mapped">✓ From Excel</span>
                            ) : field.hasAssumption ? (
                              <span className="status-assumption">✓ Default Set</span>
                            ) : (
                              <span className="status-needs-default">Needs Default</span>
                            )}
                          </td>
                          <td>
                            {field.isMapped ? (
                              <code>{field.mappedFrom}</code>
                            ) : field.hasAssumption ? (
                              <span className="assumption-value">{field.assumptionValue}</span>
                            ) : field.defaultAssumption ? (
                              <span className="suggested-default">Suggested: {field.defaultAssumption}</span>
                            ) : (
                              <span className="not-mapped">-</span>
                            )}
                          </td>
                          <td>
                            {!field.isMapped && !field.hasAssumption && (
                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => handleAddAssumption(field.field)}
                              >
                                Set Default
                              </button>
                            )}
                            {field.hasAssumption && (
                              <button
                                className="btn btn-small btn-ghost"
                                onClick={() => handleRemoveAssumption(field.field)}
                              >
                                Clear
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Optional Fields */}
            {readiness.fieldCoverage.filter(f => f.requirementCategory === 'optional' && f.isMapped).length > 0 && (
              <div className="coverage-section">
                <h4 className="section-title section-optional">
                  Optional (Mapped)
                  <span className="section-hint">Additional fields from your Excel</span>
                </h4>
                <div className="optional-fields-list">
                  {readiness.fieldCoverage
                    .filter(f => f.requirementCategory === 'optional' && f.isMapped)
                    .map((field) => (
                      <span key={field.field} className="optional-field-chip">
                        {field.label} ← <code>{field.mappedFrom}</code>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Assumptions Editor */}
          {assumptions.length > 0 && (
            <div className="assumptions-editor">
              <h4>Default Values</h4>
              <p className="hint">These values will be used for all imported assets.</p>
              {assumptions.map((assumption) => {
                const fieldDef = readiness.fieldCoverage.find((f) => f.field === assumption.field);
                return (
                  <div key={assumption.field} className="assumption-row">
                    <label>{fieldDef?.label || assumption.field}</label>
                    <input
                      type="text"
                      value={assumption.value}
                      onChange={(e) => handleUpdateAssumption(assumption.field, e.target.value)}
                      placeholder={fieldDef?.defaultAssumption || 'Enter default value'}
                    />
                    {fieldDef?.defaultAssumption && !assumption.value && (
                      <button
                        className="btn btn-small btn-ghost"
                        onClick={() => handleUpdateAssumption(assumption.field, fieldDef.defaultAssumption!)}
                      >
                        Use Suggested
                      </button>
                    )}
                    <button
                      className="btn btn-small btn-ghost"
                      onClick={() => handleRemoveAssumption(assumption.field)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <button className="btn btn-secondary" onClick={loadReadiness}>
                Update Check
              </button>
            </div>
          )}

          {/* Match Strategy - Per Asset Identity Contract */}
          <div className="match-strategy">
            <h4>Identity Matching</h4>
            <p className="hint">
              Per Asset Identity Contract, all matching is by <strong>ID</strong> (business identity).
            </p>
            
            <div className="identity-options">
              <label className="identity-option">
                <input
                  type="radio"
                  name="matchStrategy"
                  checked={matchKeyStrategy === 'externalRef'}
                  onChange={() => setMatchKeyStrategy('externalRef')}
                />
                <div className="option-content">
                  <strong>Require ID</strong>
                  <span className="option-desc">
                    Import will fail for rows without ID mapping. (Recommended)
                  </span>
                </div>
              </label>
              
              <label className="identity-option warning">
                <input
                  type="radio"
                  name="matchStrategy"
                  checked={matchKeyStrategy === 'fallback_acknowledged'}
                  onChange={() => setMatchKeyStrategy('fallback_acknowledged')}
                />
                <div className="option-content">
                  <strong>Allow Fallback Identity</strong>
                  <span className="option-desc">
                    Generate temporary identities for rows without ID.
                    These must be replaced with real IDs later.
                  </span>
                </div>
              </label>
            </div>

            {matchKeyStrategy === 'fallback_acknowledged' && (
              <div className="identity-warning">
                <strong>⚠️ Warning:</strong> Assets created with fallback identities are marked as 
                "derived" and should be updated with real utility-internal IDs before use in 
                projections or reporting.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="readiness-actions">
            <button className="btn btn-secondary" onClick={onBack}>
              Back to Mapping
            </button>
            <button
              className="btn btn-primary"
              onClick={handleLoadPreview}
              disabled={!readiness.canProceed || previewLoading}
            >
              {previewLoading ? 'Loading Preview...' : 'Preview Import'}
            </button>
          </div>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <>
          <div className="preview-summary">
            <h4>Import Preview</h4>
            <p className="hint">This is what will happen when you execute the import.</p>

            <div className="preview-counts">
              <div className="count-card create">
                <div className="count-value">{preview.created}</div>
                <div className="count-label">New Records</div>
              </div>
              <div className="count-card update">
                <div className="count-value">{preview.updated}</div>
                <div className="count-label">Updates</div>
              </div>
              <div className="count-card skip">
                <div className="count-value">{preview.unchanged + preview.skipped}</div>
                <div className="count-label">Skipped</div>
              </div>
              {preview.errors.length > 0 && (
                <div className="count-card error">
                  <div className="count-value">{preview.errors.length}</div>
                  <div className="count-label">Errors</div>
                </div>
              )}
            </div>

            {/* Warning for derived identities */}
            {preview.derivedIdentityCount > 0 && (
              <div className="derived-identity-warning">
                <strong>⚠️ Fallback Identities:</strong>{' '}
                {preview.derivedIdentityCount} asset(s) will be created with auto-generated 
                identities. These should be updated with real utility IDs later.
              </div>
            )}

            <div className="match-info">
              <strong>Match strategy:</strong>{' '}
              {preview.matchKeyUsed === 'externalRef'
                ? 'ID (per Asset Identity Contract)'
                : preview.matchKeyUsed === 'fallback_acknowledged'
                ? 'Fallback Identity Acknowledged'
                : preview.matchKeyUsed}
            </div>

            {preview.sampleErrors.length > 0 && (
              <div className="preview-errors">
                <h5>Sample Errors</h5>
                <ul>
                  {preview.sampleErrors.map((err, idx) => (
                    <li key={idx}>
                      <strong>Row {err.row}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > preview.sampleErrors.length && (
                  <p className="more-errors">
                    ...and {preview.errors.length - preview.sampleErrors.length} more errors
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="readiness-actions">
            <button className="btn btn-secondary" onClick={() => setStep('readiness')}>
              Back to Check
            </button>
            <button
              className="btn btn-primary btn-success"
              onClick={handleExecute}
              disabled={executing || preview.errors.length > 0}
            >
              {executing ? 'Importing...' : 'Execute Import'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
