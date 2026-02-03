import React, { useState, useEffect, useCallback } from 'react';
import { getMappingSuggestions, createMapping, api } from '../api';
import type {
  ExcelSheet,
  TargetEntity,
  FieldCriticality,
  CanonicalField,
  ColumnProfile,
  CanonicalFieldType,
} from '../types';

interface MappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  reason: string;
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  criticality: FieldCriticality;
  confidence?: number;
  columnProfile?: ColumnProfile;
}

interface MappingEditorProps {
  importId: string;
  sheet: ExcelSheet;
  targetEntity: TargetEntity;
  onSave: (mappingId: string) => void;
  onCancel: () => void;
}

export const MappingEditor: React.FC<MappingEditorProps> = ({
  importId,
  sheet,
  targetEntity,
  onSave,
  onCancel,
}) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [canonicalFields, setCanonicalFields] = useState<CanonicalField[]>([]);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappingName, setMappingName] = useState(`${sheet.sheetName} mapping`);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Load canonical fields and suggestions
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch canonical fields from registry
        const fieldsResponse = await api<{ fields: CanonicalField[] }>(
          `/mappings/canonical-fields?targetEntity=${targetEntity}`,
        );
        // Filter to only fields for this entity
        const entityFields = fieldsResponse.fields.filter((f) => f.entity === targetEntity);
        setCanonicalFields(entityFields);

        // Fetch suggestions
        const suggestionsResponse = await getMappingSuggestions(importId, sheet.id);
        setSuggestions(suggestionsResponse.suggestions);

        // Build column profile lookup
        const profileMap = new Map<string, ColumnProfile>();
        if (sheet.columnsProfile) {
          for (const profile of sheet.columnsProfile) {
            profileMap.set(profile.headerRaw.toLowerCase(), profile);
          }
        }

        // Initialize mappings from suggestions
        const initialMappings: ColumnMapping[] = suggestionsResponse.suggestions.map((s) => {
          const field = entityFields.find((f) => f.field === s.targetField);
          return {
            sourceColumn: s.sourceColumn,
            targetField: s.targetField,
            criticality: field?.criticality || 'optional',
            confidence: s.confidence,
            columnProfile: profileMap.get(s.sourceColumn.toLowerCase()),
          };
        });

        // Add unmapped columns
        const mappedColumns = new Set(initialMappings.map((m) => m.sourceColumn));
        for (const header of sheet.headers) {
          if (!mappedColumns.has(header)) {
            initialMappings.push({
              sourceColumn: header,
              targetField: '',
              criticality: 'optional',
              columnProfile: profileMap.get(header.toLowerCase()),
            });
          }
        }

        setMappings(initialMappings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [importId, sheet.id, sheet.columnsProfile, targetEntity]);

  const handleTargetChange = useCallback(
    (sourceColumn: string, targetField: string) => {
      setMappings((prev) =>
        prev.map((m) => {
          if (m.sourceColumn === sourceColumn) {
            const field = canonicalFields.find((f) => f.field === targetField);
            return {
              ...m,
              targetField,
              criticality: field?.criticality || 'optional',
              confidence: undefined, // Clear confidence when manually changed
            };
          }
          return m;
        }),
      );
    },
    [canonicalFields],
  );

  const handleClearMapping = useCallback((sourceColumn: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceColumn === sourceColumn
          ? { ...m, targetField: '', criticality: 'optional', confidence: undefined }
          : m,
      ),
    );
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const columns = mappings
        .filter((m) => m.targetField)
        .map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          criticality: m.criticality,
          required: m.criticality === 'law_critical',
        }));

      if (columns.length === 0) {
        setError('Please map at least one column');
        return;
      }

      const mapping = await createMapping({
        name: mappingName,
        targetEntity,
        isTemplate: saveAsTemplate,
        columns,
      } as any);

      onSave(mapping.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const getMappedFieldsCount = () => mappings.filter((m) => m.targetField).length;
  const getLawCriticalMissing = () => {
    const mappedTargets = new Set(mappings.filter((m) => m.targetField).map((m) => m.targetField));
    return canonicalFields.filter((f) => f.criticality === 'law_critical' && !mappedTargets.has(f.field));
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return '';
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  };

  const getCriticalityBadge = (criticality: FieldCriticality) => {
    switch (criticality) {
      case 'law_critical':
        return <span className="criticality-badge criticality-law">Required</span>;
      case 'model_critical':
        return <span className="criticality-badge criticality-model">Important</span>;
      default:
        return <span className="criticality-badge criticality-optional">Optional</span>;
    }
  };

  if (loading) {
    return (
      <div className="mapping-editor">
        <div className="loading-spinner">Loading mapping data...</div>
      </div>
    );
  }

  const lawCriticalMissing = getLawCriticalMissing();

  return (
    <div className="mapping-editor">
      <div className="mapping-editor-header">
        <h3>Configure Column Mapping</h3>
        <p className="mapping-description">
          Map Excel columns to canonical fields. Auto-detected mappings are highlighted.
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-small">
            Dismiss
          </button>
        </div>
      )}

      <div className="mapping-meta">
        <div className="mapping-name-input">
          <label htmlFor="mapping-name">Mapping Name</label>
          <input
            id="mapping-name"
            type="text"
            value={mappingName}
            onChange={(e) => setMappingName(e.target.value)}
            placeholder="Enter mapping name"
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
          />
          Save as reusable template
        </label>
      </div>

      <div className="mapping-stats">
        <span className="stat">
          {getMappedFieldsCount()} of {sheet.headers.length} columns mapped
        </span>
        {lawCriticalMissing.length > 0 && (
          <span className="stat stat-warning">
            {lawCriticalMissing.length} required field(s) not mapped
          </span>
        )}
      </div>

      {lawCriticalMissing.length > 0 && (
        <div className="missing-fields-warning">
          <strong>Missing required fields:</strong>
          <ul>
            {lawCriticalMissing.map((f) => (
              <li key={f.field}>
                {f.field} <span className="hint">({f.examples.join(', ')})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mapping-table-container">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Excel Column</th>
              <th>Type</th>
              <th>Maps To</th>
              <th>Importance</th>
              <th>Confidence</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.sourceColumn} className={mapping.targetField ? 'mapped' : ''}>
                <td className="source-column">
                  <code>{mapping.sourceColumn}</code>
                  {mapping.columnProfile && (
                    <div className="column-profile-hint">
                      {mapping.columnProfile.exampleValues.length > 0 && (
                        <span className="example-values" title={mapping.columnProfile.exampleValues.join(', ')}>
                          e.g. {mapping.columnProfile.exampleValues[0].slice(0, 20)}
                          {mapping.columnProfile.exampleValues[0].length > 20 ? '...' : ''}
                        </span>
                      )}
                      {mapping.columnProfile.emptyRate > 0 && (
                        <span className="empty-rate">{mapping.columnProfile.emptyRate}% empty</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="column-type">
                  {mapping.columnProfile ? (
                    <span className={`type-badge type-${mapping.columnProfile.inferredType}`}>
                      {mapping.columnProfile.inferredType}
                    </span>
                  ) : (
                    <span className="type-badge type-unknown">?</span>
                  )}
                </td>
                <td>
                  <select
                    value={mapping.targetField}
                    onChange={(e) => handleTargetChange(mapping.sourceColumn, e.target.value)}
                    className="target-select"
                  >
                    <option value="">-- Not mapped --</option>
                    {canonicalFields.map((field) => (
                      <option key={field.field} value={field.field}>
                        {field.label || field.field}
                        {field.required ? ' *' : ''}
                        {field.type ? ` (${field.type})` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{mapping.targetField && getCriticalityBadge(mapping.criticality)}</td>
                <td>
                  {mapping.confidence !== undefined && (
                    <span className={`confidence-indicator ${getConfidenceColor(mapping.confidence)}`}>
                      {Math.round(mapping.confidence * 100)}%
                    </span>
                  )}
                </td>
                <td>
                  {mapping.targetField && (
                    <button
                      className="btn btn-small btn-ghost"
                      onClick={() => handleClearMapping(mapping.sourceColumn)}
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

      <div className="mapping-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || getMappedFieldsCount() === 0}
        >
          {saving ? 'Saving...' : 'Save Mapping'}
        </button>
      </div>
    </div>
  );
};
