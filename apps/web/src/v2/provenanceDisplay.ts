const mojibakePattern = /[ÃƒÆ’Ãƒâ€šÃƒÂ¢]/;
const nordicPattern = /[Ã…Ã„Ã–Ã¥Ã¤Ã¶]/;

type DocumentImportSourceLineLike = {
  text?: string | null;
  pageNumber?: number | null;
};

type OverrideProvenanceLike = {
  kind?: string | null;
  fileName?: string | null;
  pageNumber?: number | null;
  pageNumbers?: number[] | null;
  sourceLines?: DocumentImportSourceLineLike[] | null;
  fieldSources?:
    | Array<{
        provenance?: OverrideProvenanceLike | null;
      } | null>
    | null;
};

function recoverLatin1Mojibake(value: string): string {
  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function collectDocumentImportProvenances(
  value: OverrideProvenanceLike | null | undefined,
): OverrideProvenanceLike[] {
  if (!value) {
    return [];
  }
  const refs: OverrideProvenanceLike[] = [value];
  for (const fieldSource of value.fieldSources ?? []) {
    if (fieldSource?.provenance) {
      refs.push(fieldSource.provenance);
    }
  }
  return refs.filter((item) => item.kind === 'document_import');
}

function collectProvenancesByKind(
  value: OverrideProvenanceLike | null | undefined,
  kind: string,
): OverrideProvenanceLike[] {
  if (!value) {
    return [];
  }
  const refs: OverrideProvenanceLike[] = [value];
  for (const fieldSource of value.fieldSources ?? []) {
    if (fieldSource?.provenance) {
      refs.push(fieldSource.provenance);
    }
  }
  return refs.filter((item) => item.kind === kind);
}

export function normalizeImportedFileName(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!mojibakePattern.test(trimmed)) {
    return trimmed;
  }
  try {
    const recovered = recoverLatin1Mojibake(trimmed);
    if (nordicPattern.test(recovered) && !mojibakePattern.test(recovered)) {
      return recovered;
    }
  } catch {
    // Keep the original value if decoding fails.
  }
  return trimmed;
}

export function formatDocumentImportPageLabel(
  pageNumbers: number[],
): string | null {
  if (pageNumbers.length === 0) {
    return null;
  }
  if (pageNumbers.length === 1) {
    return `p. ${pageNumbers[0]}`;
  }
  return `pp. ${pageNumbers.join(', ')}`;
}

export function getDocumentImportEvidence(
  value: OverrideProvenanceLike | null | undefined,
  maxLines = 2,
): {
  fileName: string | null;
  pageNumbers: number[];
  pageLabel: string | null;
  sourceLines: string[];
} {
  const refs = collectDocumentImportProvenances(value);
  if (refs.length === 0) {
    return {
      fileName: null,
      pageNumbers: [],
      pageLabel: null,
      sourceLines: [],
    };
  }
  const fileName =
    refs.map((item) => item.fileName?.trim() ?? '').find((item) => item.length > 0) ??
    null;
  const pageNumbers = [...new Set(
    refs.flatMap((item) => [
      ...(Array.isArray(item.pageNumbers) ? item.pageNumbers : []),
      ...(item.pageNumber != null ? [item.pageNumber] : []),
      ...((item.sourceLines ?? [])
        .map((line) => line.pageNumber)
        .filter((pageNumber): pageNumber is number => pageNumber != null)),
    ]),
  )]
    .filter((pageNumber) => Number.isFinite(pageNumber))
    .sort((left, right) => left - right);
  const sourceLines = [...new Map(
    refs
      .flatMap((item) => item.sourceLines ?? [])
      .map((line) => {
        const text = line.text?.trim();
        if (!text) {
          return null;
        }
        const prefix =
          line.pageNumber != null && Number.isFinite(line.pageNumber)
            ? `p. ${line.pageNumber}: `
            : '';
        const rendered = `${prefix}${text}`;
        return [rendered, rendered] as const;
      })
      .filter((line): line is readonly [string, string] => line != null),
  ).values()].slice(0, maxLines);

  return {
    fileName,
    pageNumbers,
    pageLabel: formatDocumentImportPageLabel(pageNumbers),
    sourceLines,
  };
}

export function getImportedFileNameByKind(
  value: OverrideProvenanceLike | null | undefined,
  kind: string,
  fallback: string,
): string {
  const refs = collectProvenancesByKind(value, kind);
  const fileName =
    refs.map((item) => item.fileName?.trim() ?? '').find((item) => item.length > 0) ??
    null;
  return normalizeImportedFileName(fileName, fallback);
}
