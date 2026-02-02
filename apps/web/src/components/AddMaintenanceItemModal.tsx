import React, { useState } from 'react';
import type { MaintenanceKind } from '../types';

interface FormData {
  kind: MaintenanceKind;
  intervalYears: number;
  costEur: number;
  startsAtYear?: number;
  notes?: string;
}

interface AddMaintenanceItemModalProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  submitting: boolean;
  error: string | null;
}

const currentYear = new Date().getFullYear();

export const AddMaintenanceItemModal: React.FC<AddMaintenanceItemModalProps> = ({
  onClose,
  onSubmit,
  submitting,
  error,
}) => {
  const [kind, setKind] = useState<MaintenanceKind>('MAINTENANCE');
  const [intervalYears, setIntervalYears] = useState<number>(1);
  const [costEur, setCostEur] = useState<string>('');
  const [startsAtYear, setStartsAtYear] = useState<string>(String(currentYear));
  const [notes, setNotes] = useState<string>('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (kind === 'MAINTENANCE' && intervalYears < 1) {
      newErrors.intervalYears = 'Interval must be at least 1 year';
    }

    const cost = parseFloat(costEur);
    if (!costEur || isNaN(cost) || cost <= 0) {
      newErrors.costEur = 'Cost must be a positive number';
    }

    const startYear = parseInt(startsAtYear, 10);
    if (startsAtYear && (isNaN(startYear) || startYear < 2000 || startYear > 2100)) {
      newErrors.startsAtYear = 'Enter a valid year (2000-2100)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      kind,
      intervalYears: kind === 'MAINTENANCE' ? intervalYears : 1, // REPLACEMENT doesn't need interval
      costEur: parseFloat(costEur),
      startsAtYear: startsAtYear ? parseInt(startsAtYear, 10) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  // Prevent modal click from closing
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <h3>Add Maintenance Item</h3>
          <button onClick={onClose} className="modal-close" disabled={submitting}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Error banner */}
          {error && (
            <div className="form-error-banner">
              {error}
            </div>
          )}

          {/* Kind */}
          <div className="form-group">
            <label htmlFor="kind">Type</label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as MaintenanceKind)}
              className="form-input"
              disabled={submitting}
            >
              <option value="MAINTENANCE">Maintenance (recurring)</option>
              <option value="REPLACEMENT">Replacement (one-time)</option>
            </select>
          </div>

          {/* Interval (only for MAINTENANCE) */}
          {kind === 'MAINTENANCE' && (
            <div className="form-group">
              <label htmlFor="intervalYears">Interval (years)</label>
              <input
                id="intervalYears"
                type="number"
                value={intervalYears}
                onChange={(e) => setIntervalYears(parseInt(e.target.value, 10) || 1)}
                min={1}
                max={50}
                className={`form-input ${errors.intervalYears ? 'form-input-error' : ''}`}
                disabled={submitting}
              />
              {errors.intervalYears && (
                <span className="form-error">{errors.intervalYears}</span>
              )}
            </div>
          )}

          {/* Cost */}
          <div className="form-group">
            <label htmlFor="costEur">Cost (€)</label>
            <input
              id="costEur"
              type="number"
              value={costEur}
              onChange={(e) => setCostEur(e.target.value)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className={`form-input ${errors.costEur ? 'form-input-error' : ''}`}
              disabled={submitting}
            />
            {errors.costEur && <span className="form-error">{errors.costEur}</span>}
          </div>

          {/* Starts At Year */}
          <div className="form-group">
            <label htmlFor="startsAtYear">Starts At Year</label>
            <input
              id="startsAtYear"
              type="number"
              value={startsAtYear}
              onChange={(e) => setStartsAtYear(e.target.value)}
              min={2000}
              max={2100}
              placeholder={String(currentYear)}
              className={`form-input ${errors.startsAtYear ? 'form-input-error' : ''}`}
              disabled={submitting}
            />
            {errors.startsAtYear && (
              <span className="form-error">{errors.startsAtYear}</span>
            )}
            <span className="form-hint">
              {kind === 'MAINTENANCE'
                ? 'First year this maintenance starts'
                : 'Year when replacement occurs'}
            </span>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="form-input form-textarea"
              placeholder="e.g. Annual inspection, Filter replacement..."
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
