import React from 'react';

import type { V2ImportYearDataResponse } from '../api';
import type {
  DocumentImportFieldMatch,
  DocumentImportPreview,
} from './documentPdfImportModel';
import { formatEur,formatNumber,formatPrice } from './format';
import {
  buildFinancialForm,
  buildPriceForm,
  buildVolumeForm,
} from './overviewManualForms';

type Props = {
  preview: DocumentImportPreview;
  currentYearData?: V2ImportYearDataResponse;
  currentLabel?: string;
  missingValueLabel?: string;
  reviewedKeys?: DocumentImportFieldMatch['key'][];
  onSelectMatch?: (
    key: DocumentImportFieldMatch['key'],
    selectedMatch: DocumentImportFieldMatch | null,
  ) => void;
};

export const DocumentImportPreviewDetails: React.FC<Props> = ({
  preview,
  currentYearData,
  currentLabel = 'Current',
  missingValueLabel = 'Missing data',
  reviewedKeys = [],
  onSelectMatch,
}) => {
  const candidateMatches = preview.candidateMatches ?? preview.matches;
  const currentValues = React.useMemo(() => {
    const financials = buildFinancialForm(currentYearData);
    const prices = buildPriceForm(currentYearData);
    const volumes = buildVolumeForm(currentYearData);
    return {
      ...financials,
      ...prices,
      ...volumes,
    };
  }, [currentYearData]);
  const candidateGroups = React.useMemo(() => {
    const groups = new Map<DocumentImportFieldMatch['key'], typeof candidateMatches>();
    for (const match of candidateMatches) {
      const next = groups.get(match.key) ?? [];
      next.push(match);
      groups.set(match.key, next);
    }
    return [...groups.entries()].map(([key, matches]) => ({
      key,
      label: matches[0]?.label ?? key,
      datasetKind: matches[0]?.datasetKind ?? 'financials',
      selectedSourceLine:
        preview.matches.find((match) => match.key === key)?.sourceLine ?? null,
      matches,
      selectedMatch: preview.matches.find((match) => match.key === key) ?? null,
    }));
  }, [candidateMatches, preview.matches]);

  if (
    preview.matches.length === 0 &&
    candidateMatches.length === 0 &&
    preview.sourceLines.length === 0 &&
    preview.rawText.trim().length === 0
  ) {
    return null;
  }

  return (
    <>
      {preview.matches.length > 0 ? (
        <div className="v2-keyvalue-list">
          {preview.matches.map((match) => {
            const currentValue =
              currentValues[match.key as keyof typeof currentValues];
            return (
              <div
                key={`${match.key}-${match.pageNumber ?? '-'}-${match.sourceLine}`}
                className="v2-keyvalue-row"
              >
                <span>{match.label}</span>
                <span>
                  {typeof currentValue === 'number' && Number.isFinite(currentValue)
                    ? `${formatMatchValue(match.datasetKind, currentValue)} -> `
                    : ''}
                  {formatMatchValue(match.datasetKind, match.value)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {candidateGroups.some((group) => group.matches.length > 1) ? (
        <div className="v2-document-import-candidate-groups">
          {candidateGroups
            .filter((group) => group.matches.length > 1)
            .map((group) => (
              <details key={group.key} className="v2-document-import-candidate-group">
                <summary>
                  {group.label} ({group.matches.length})
                </summary>
                <div className="v2-document-import-candidate-list">
                  {group.matches.map((match, index) => (
                    <small
                      key={`${group.key}-${match.pageNumber ?? '-'}-${match.sourceLine}-${index}`}
                      className="v2-muted"
                    >
                      {formatMatchValue(group.datasetKind, match.value)}
                      {match.pageNumber != null ? ` | ${match.pageNumber}` : ''}
                      {' | '}
                      {match.sourceLine}
                      {group.selectedSourceLine === match.sourceLine ? ' | *' : ''}
                    </small>
                  ))}
                </div>
              </details>
            ))}
        </div>
      ) : null}

      {onSelectMatch ? (
        <div className="v2-document-import-selection-groups">
          {candidateGroups.map((group) => {
            const currentValue = currentValues[group.key as keyof typeof currentValues];
            const isReviewed = reviewedKeys.includes(group.key);
            return (
              <fieldset
                key={`selection-${group.key}`}
                className="v2-document-import-selection-group"
                data-document-import-select={group.key}
              >
                <legend>{group.label}</legend>
                <label
                  className="v2-document-import-selection-option"
                  data-document-import-choice={`${group.key}-current`}
                >
                  <input
                    type="radio"
                    name={`document-import-${group.key}`}
                    checked={isReviewed && group.selectedMatch == null}
                    onChange={() => onSelectMatch(group.key, null)}
                  />
                  <span>
                    {currentLabel}:{' '}
                    {typeof currentValue === 'number' &&
                    Number.isFinite(currentValue)
                      ? formatMatchValue(group.datasetKind, currentValue)
                      : missingValueLabel}
                  </span>
                </label>
                {group.matches.map((match, index) => (
                  <label
                    key={`${group.key}-${match.pageNumber ?? '-'}-${match.sourceLine}-${index}`}
                    className="v2-document-import-selection-option"
                    data-document-import-choice={`${group.key}-${index}`}
                  >
                    <input
                      type="radio"
                      name={`document-import-${group.key}`}
                      checked={
                        isReviewed &&
                        group.selectedMatch?.pageNumber === match.pageNumber &&
                        group.selectedMatch?.sourceLine === match.sourceLine &&
                        group.selectedMatch?.value === match.value
                      }
                      onChange={() => onSelectMatch(group.key, match)}
                    />
                    <span>
                      {formatMatchValue(group.datasetKind, match.value)}
                      {match.pageNumber != null ? ` | ${match.pageNumber}` : ''}
                      {' | '}
                      {match.sourceLine}
                    </span>
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      ) : null}

      {preview.sourceLines.length > 0 ? (
        <div className="v2-statement-import-lines">
          {preview.sourceLines.slice(0, 8).map((line) => (
            <small
              key={`${line.pageNumber ?? '-'}:${line.text}`}
              className="v2-muted"
            >
              {line.pageNumber != null ? `${line.pageNumber}: ` : ''}
              {line.text}
            </small>
          ))}
        </div>
      ) : null}

      {preview.rawText.trim().length > 0 ? (
        <pre className="v2-document-import-raw-text">
          {preview.rawText.trim().slice(0, 1600)}
        </pre>
      ) : null}
    </>
  );
};

function formatMatchValue(
  datasetKind: DocumentImportPreview['matches'][number]['datasetKind'],
  value: number,
): string {
  if (datasetKind === 'financials') {
    return formatEur(value);
  }
  if (datasetKind === 'prices') {
    return formatPrice(value);
  }
  return `${formatNumber(value, 0)} m3`;
}
