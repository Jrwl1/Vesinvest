import type {
  BaselineDatasetSource,
  DatasetProvenance,
  ReportSnapshot,
} from './v2-report-pdf.types';
import { DEFAULT_VESINVEST_GROUP_DEFINITIONS } from './vesinvest-contract';

const AUTHORITATIVE_VESINVEST_GROUP_LABELS = new Map(
  DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group) => [group.key, group.label] as const),
);

export const normalizeYearList = (
  values: Array<number | null | undefined>,
): number[] =>
  [...new Set(
    values.filter((value): value is number => Number.isFinite(value)).map((value) =>
      Math.trunc(value),
    ),
  )].sort((left, right) => left - right);

export const resolveAcceptedBaselineYears = (
  snapshot: ReportSnapshot,
): number[] => {
  const explicitYears = normalizeYearList(snapshot?.acceptedBaselineYears ?? []);
  if (explicitYears.length > 0) {
    return explicitYears;
  }
  return normalizeYearList([
    ...(snapshot?.baselineSourceSummaries ?? []).map((summary) => summary?.year),
    snapshot?.baselineSourceSummary?.year,
  ]);
};

export const formatAcceptedBaselineYears = (snapshot: ReportSnapshot): string => {
  const years = resolveAcceptedBaselineYears(snapshot);
  return years.length > 0 ? years.join(', ') : '-';
};

export const normalizeVesinvestClassLabel = (
  classKey: string | null | undefined,
  fallbackLabel: string | null | undefined,
): string => {
  const normalizedKey = String(classKey ?? '').trim();
  if (normalizedKey.length > 0) {
    const authoritativeLabel =
      AUTHORITATIVE_VESINVEST_GROUP_LABELS.get(normalizedKey);
    if (authoritativeLabel) {
      return authoritativeLabel;
    }
  }
  const normalizedFallback = String(fallbackLabel ?? '').trim();
  if (normalizedFallback.length > 0) {
    return normalizedFallback;
  }
  return normalizedKey || '-';
};

type SupportParams = {
  toPdfText: (value: string) => string;
  normalizeText: (value: string | null | undefined) => string | null;
  toNumber: (value: unknown) => number;
  pdfLocale: string;
};

export function createPdfReportSupport({
  toPdfText,
  normalizeText,
  toNumber,
  pdfLocale,
}: SupportParams) {
  const language = pdfLocale.toLowerCase().startsWith('sv')
    ? 'sv'
    : pdfLocale.toLowerCase().startsWith('fi')
    ? 'fi'
    : 'en';
  const labels = {
    serviceSplit: {
      water: language === 'sv' ? 'Vatten' : language === 'fi' ? 'Vesi' : 'Water',
      wastewater:
        language === 'sv'
          ? 'Avlopp'
          : language === 'fi'
          ? 'Jatevesi'
          : 'Wastewater',
      mixed: language === 'sv' ? 'Blandad' : language === 'fi' ? 'Sekoitettu' : 'Mixed',
    },
    depreciation: {
      straightLine:
        language === 'sv'
          ? 'Rak avskrivning'
          : language === 'fi'
          ? 'Tasapoisto'
          : 'Straight-line',
      linear: language === 'sv' ? 'Linjär' : language === 'fi' ? 'Lineaarinen' : 'Linear',
      residual:
        language === 'sv'
          ? 'Restvärde'
          : language === 'fi'
          ? 'Menojäännös'
          : 'Residual',
      none:
        language === 'sv'
          ? 'Ingen avskrivning'
          : language === 'fi'
          ? 'Ei poistoa'
          : 'No depreciation',
      years: language === 'sv' ? 'år' : language === 'fi' ? 'vuotta' : 'years',
    },
    assumptions: {
      inflation: language === 'sv' ? 'Inflation' : language === 'fi' ? 'Inflaatio' : 'Inflation',
      energyFactor:
        language === 'sv'
          ? 'Energifaktor'
          : language === 'fi'
          ? 'Energiakerroin'
          : 'Energy factor',
      personnelFactor:
        language === 'sv'
          ? 'Personalfaktor'
          : language === 'fi'
          ? 'Henkilostokerroin'
          : 'Personnel factor',
      volumeChange:
        language === 'sv'
          ? 'Volymforandring'
          : language === 'fi'
          ? 'Volyymin muutos'
          : 'Volume change',
      priceIncrease:
        language === 'sv'
          ? 'Prishojning'
          : language === 'fi'
          ? 'Hinnankorotus'
          : 'Price increase',
      baseFeeChange:
        language === 'sv'
          ? 'Grundavgiftsandring'
          : language === 'fi'
          ? 'Perusmaksun muutos'
          : 'Base fee change',
      investmentFactor:
        language === 'sv'
          ? 'Investeringsfaktor'
          : language === 'fi'
          ? 'Investointikerroin'
          : 'Investment factor',
    },
    dataset: {
      evidenceAndWorkbook:
        language === 'sv'
          ? 'Underlag + Excel-korrigering'
          : language === 'fi'
          ? 'Aineisto + Excel-korjaus'
          : 'Evidence file + workbook repair',
      statementAndWorkbook:
        language === 'sv'
          ? 'Boksluts-PDF + Excel-korrigering'
          : language === 'fi'
          ? 'Tilinpaatos-PDF + Excel-korjaus'
          : 'Statement PDF + workbook repair',
      evidenceFile:
        language === 'sv'
          ? 'Underlag'
          : language === 'fi'
          ? 'Aineisto'
          : 'Evidence file',
      statementPdf:
        language === 'sv'
          ? 'Boksluts-PDF'
          : language === 'fi'
          ? 'Tilinpäätös-PDF'
          : 'Statement PDF',
      workbookImport:
        language === 'sv'
          ? 'Excel-import'
          : language === 'fi'
          ? 'Excel-tuonti'
          : 'Workbook import',
      manualReview:
        language === 'sv'
          ? 'Manuell granskning'
          : language === 'fi'
          ? 'Manuaalinen tarkistus'
          : 'Manual review',
    },
    sourceStatus: {
      veeti: 'VEETI',
      manual:
        language === 'sv'
          ? 'Manuell granskning'
          : language === 'fi'
          ? 'Manuaalinen tarkistus'
          : 'Manual review',
      mixed:
        language === 'sv'
          ? 'Blandat underlag'
          : language === 'fi'
          ? 'Yhdistetty aineisto'
          : 'Mixed sources',
      incomplete:
        language === 'sv'
          ? 'Ofullständigt'
          : language === 'fi'
          ? 'Puutteellinen'
          : 'Incomplete',
    },
    datasetTypes: {
      energia: language === 'sv' ? 'Energi' : language === 'fi' ? 'Energia' : 'Energy',
      investointi:
        language === 'sv'
          ? 'Investeringar'
          : language === 'fi'
          ? 'Investoinnit'
          : 'Investments',
      taksa: language === 'sv' ? 'Avgifter' : language === 'fi' ? 'Taksat' : 'Tariffs',
      tilinpaatos:
        language === 'sv'
          ? 'Bokslut'
          : language === 'fi'
          ? 'Tilinpäätös'
          : 'Financial statements',
      verkko: language === 'sv' ? 'Nät' : language === 'fi' ? 'Verkko' : 'Network',
      volume_jatevesi:
        language === 'sv'
          ? 'Sålt avlopp'
          : language === 'fi'
          ? 'Myyty jätevesi'
          : 'Sold wastewater',
      volume_vesi:
        language === 'sv'
          ? 'Sålt vatten'
          : language === 'fi'
          ? 'Myyty vesi'
          : 'Sold water',
    },
    investmentTypes: {
      replacement:
        language === 'sv'
          ? 'Förnyelse'
          : language === 'fi'
          ? 'Saneeraus'
          : 'Renewal',
      sanering:
        language === 'sv'
          ? 'Sanering'
          : language === 'fi'
          ? 'Saneeraus'
          : 'Rehabilitation',
      nyanlaggning:
        language === 'sv'
          ? 'Nyanläggning'
          : language === 'fi'
          ? 'Uudisrakentaminen'
          : 'New build',
      new_build:
        language === 'sv'
          ? 'Nyanläggning'
          : language === 'fi'
          ? 'Uudisrakentaminen'
          : 'New build',
      repair:
        language === 'sv'
          ? 'Reparation'
          : language === 'fi'
          ? 'Korjaus'
          : 'Repair',
    },
    confidence: {
      high: language === 'sv' ? 'Hög' : language === 'fi' ? 'Korkea' : 'High',
      medium: language === 'sv' ? 'Medel' : language === 'fi' ? 'Keskitaso' : 'Medium',
      low: language === 'sv' ? 'Låg' : language === 'fi' ? 'Matala' : 'Low',
    },
  };
  const formatMoney = (value: number) =>
    `${Math.round(value).toLocaleString(pdfLocale)} EUR`;
  const formatPrice = (value: number) =>
    `${value.toLocaleString(pdfLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR/m³`;
  const formatPct = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${value.toLocaleString(pdfLocale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} %`;
  const formatServiceSplit = (value: 'water' | 'wastewater' | 'mixed') => {
    switch (value) {
      case 'water':
        return labels.serviceSplit.water;
      case 'wastewater':
        return labels.serviceSplit.wastewater;
      default:
        return labels.serviceSplit.mixed;
    }
  };
  const humanizeInternalKey = (value: string | null | undefined) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '-';
    }
    return normalized
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };
  const formatSourceStatus = (value: string | null | undefined) => {
    switch (String(value ?? '').toUpperCase()) {
      case 'VEETI':
        return labels.sourceStatus.veeti;
      case 'MANUAL':
        return labels.sourceStatus.manual;
      case 'MIXED':
        return labels.sourceStatus.mixed;
      case 'INCOMPLETE':
      default:
        return labels.sourceStatus.incomplete;
    }
  };
  const formatDatasetType = (value: string | null | undefined) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '-';
    }
    return labels.datasetTypes[normalized as keyof typeof labels.datasetTypes] ??
      humanizeInternalKey(normalized);
  };
  const formatDatasetTypeList = (values: string[] | null | undefined) => {
    if (!values?.length) {
      return '-';
    }
    return values.map(formatDatasetType).join(', ');
  };
  const formatVesinvestKeyLabel = (
    key: string | null | undefined,
    fallbackLabel?: string | null,
  ) => {
    const normalized = normalizeVesinvestClassLabel(key, fallbackLabel);
    if (normalized && normalized !== String(key ?? '').trim()) {
      return normalized;
    }
    return humanizeInternalKey(normalized);
  };
  const formatInvestmentType = (value: string | null | undefined) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '-';
    }
    return labels.investmentTypes[normalized as keyof typeof labels.investmentTypes] ??
      humanizeInternalKey(normalized);
  };
  const formatConfidence = (value: string | null | undefined) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '-';
    }
    return labels.confidence[normalized as keyof typeof labels.confidence] ??
      humanizeInternalKey(normalized);
  };
  const formatDepreciationMethod = ({
    method,
    linearYears,
    residualPercent,
  }: {
    method: string;
    linearYears?: number | null;
    residualPercent?: number | null;
  }) => {
    switch (method) {
      case 'straight-line':
        return `${labels.depreciation.straightLine} ${linearYears ?? 0} ${
          labels.depreciation.years
        }`;
      case 'linear':
        return labels.depreciation.linear;
      case 'residual':
        return `${labels.depreciation.residual} ${residualPercent ?? 0} %`;
      case 'none':
      default:
        return labels.depreciation.none;
    }
  };
  const formatVolume = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${Math.round(value).toLocaleString(pdfLocale)} m³`;
  const assumptionLabels: Record<string, string> = {
    inflaatio: labels.assumptions.inflation,
    energiakerroin: labels.assumptions.energyFactor,
    henkilostokerroin: labels.assumptions.personnelFactor,
    vesimaaran_muutos: labels.assumptions.volumeChange,
    hintakorotus: labels.assumptions.priceIncrease,
    perusmaksuMuutos: labels.assumptions.baseFeeChange,
    investointikerroin: labels.assumptions.investmentFactor,
  };
  const formatAssumptionValue = (key: string, value: number) => {
    if (key === 'investointikerroin') {
      return toNumber(value).toLocaleString(pdfLocale, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
    }
    return formatPct(toNumber(value) * 100);
  };

  const collectDocumentImportRefs = (
    provenance: DatasetProvenance,
  ): NonNullable<DatasetProvenance>[] => {
    if (!provenance) {
      return [];
    }
    const refs: NonNullable<DatasetProvenance>[] = [provenance];
    for (const fieldSource of provenance.fieldSources ?? []) {
      if (fieldSource?.provenance) {
        refs.push(fieldSource.provenance);
      }
    }
    return refs.filter((item) => item.kind === 'document_import');
  };

  const collectProvenancesByKind = (
    provenance: DatasetProvenance,
    kind: string,
  ): NonNullable<DatasetProvenance>[] => {
    if (!provenance) {
      return [];
    }
    const refs: NonNullable<DatasetProvenance>[] = [provenance];
    for (const fieldSource of provenance.fieldSources ?? []) {
      if (fieldSource?.provenance) {
        refs.push(fieldSource.provenance);
      }
    }
    return refs.filter((item) => item.kind === kind);
  };

  const formatDocumentPageLabel = (pageNumbers: number[]) => {
    if (pageNumbers.length === 0) return null;
    if (pageNumbers.length === 1) return `p. ${pageNumbers[0]}`;
    return `pp. ${pageNumbers.join(', ')}`;
  };

  const getDocumentImportEvidence = (provenance: DatasetProvenance) => {
    const refs = collectDocumentImportRefs(provenance);
    if (refs.length === 0) {
      return {
        fileName: null as string | null,
        pageLabel: null as string | null,
        sourceLines: [] as string[],
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
    ).values()].slice(0, 2);
    return {
      fileName,
      pageLabel: formatDocumentPageLabel(pageNumbers),
      sourceLines,
    };
  };

  const getImportedFileNameByKind = (
    provenance: DatasetProvenance,
    kind: string,
    fallback: string,
  ) =>
    collectProvenancesByKind(provenance, kind)
      .map((item) => item.fileName?.trim() ?? '')
      .find((item) => item.length > 0) ?? fallback;

  const formatDatasetSource = (
    dataset: BaselineDatasetSource | undefined,
    fallback: string,
  ) => {
    if (!dataset) return fallback;
    const documentEvidence = getDocumentImportEvidence(dataset.provenance);
    const documentFileName =
      documentEvidence.fileName ?? dataset.provenance?.fileName ?? 'PDF';
    const withDocumentPages = (value: string) =>
      documentEvidence.pageLabel ? `${value} | ${documentEvidence.pageLabel}` : value;
    const hasDocumentImport =
      dataset.provenance?.kind === 'document_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'document_import',
      ) ?? false);
    const hasStatementImport =
      dataset.provenance?.kind === 'statement_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'statement_import',
      ) ?? false);
    const hasWorkbookImport =
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) =>
          item.provenance.kind === 'kva_import' ||
          item.provenance.kind === 'excel_import',
      ) ?? false);
    if (hasDocumentImport && hasWorkbookImport) {
      return withDocumentPages(
        `${labels.dataset.evidenceAndWorkbook} (${documentFileName})`,
      );
    }
    if (hasStatementImport && hasWorkbookImport) {
      return `${labels.dataset.statementAndWorkbook} (${getImportedFileNameByKind(
        dataset.provenance,
        'statement_import',
        'OCR',
      )})`;
    }
    if (hasDocumentImport) {
      return withDocumentPages(`${labels.dataset.evidenceFile} (${documentFileName})`);
    }
    if (dataset.provenance?.kind === 'statement_import') {
      return `${labels.dataset.statementPdf} (${dataset.provenance.fileName ?? 'OCR'})`;
    }
    if (dataset.provenance?.kind === 'qdis_import') {
      return `QDIS PDF (${dataset.provenance.fileName ?? 'QDIS'})`;
    }
    if (
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import'
    ) {
      return `${labels.dataset.workbookImport} (${dataset.provenance.fileName ?? 'Excel'})`;
    }
    if (dataset.source === 'manual') {
      return labels.dataset.manualReview;
    }
    if (dataset.source === 'veeti') {
      return 'VEETI';
    }
    return fallback;
  };

  const formatDatasetEvidenceDetail = (dataset: BaselineDatasetSource | undefined) => {
    if (!dataset) {
      return null;
    }
    const documentEvidence = getDocumentImportEvidence(dataset.provenance);
    const parts = [documentEvidence.pageLabel, ...documentEvidence.sourceLines].filter(
      (value): value is string => Boolean(value),
    );
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  const formatAllocationLines = (
    allocations:
      | Array<{
          year: number;
          totalAmount: number;
        }>
      | null
      | undefined,
  ) => {
    if (!allocations?.length) {
      return [] as string[];
    }
    const entries = [...allocations]
      .sort((left, right) => left.year - right.year)
      .map((allocation) => `${allocation.year}: ${formatMoney(allocation.totalAmount)}`);
    const lines: string[] = [];
    for (let index = 0; index < entries.length; index += 3) {
      lines.push(entries.slice(index, index + 3).join('  |  '));
    }
    return lines;
  };

  return {
    assumptionLabels,
    formatAllocationLines,
    formatAssumptionValue,
    formatDatasetEvidenceDetail,
    formatDatasetSource,
    formatDatasetTypeList,
    formatDepreciationMethod,
    formatConfidence,
    formatInvestmentType,
    formatMoney,
    formatPct,
    formatPrice,
    formatServiceSplit,
    formatSourceStatus,
    formatVesinvestKeyLabel,
    formatVolume,
    normalizeText,
    toPdfText,
  };
}
