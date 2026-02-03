import React from 'react';
import { SanitySummary } from './SanitySummary';

interface SanitySummaryModalProps {
  importId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SanitySummaryModal: React.FC<SanitySummaryModalProps> = ({
  importId,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content sanity-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <SanitySummary importId={importId} onClose={onClose} />
      </div>
    </div>
  );
};
