import { PDFDocument, StandardFonts } from 'pdf-lib';

type ReportVariant = 'public_summary' | 'confidential_appendix';

type ReportSections = {
  baselineSources: boolean;
  investmentPlan: boolean;
  assumptions: boolean;
  yearlyInvestments: boolean;
  riskSummary: boolean;
};

type DatasetProvenance = {
  kind?: string | null;
  fileName?: string | null;
  pageNumber?: number | null;
  pageNumbers?: number[] | null;
  sourceLines?:
    | Array<{
        text?: string | null;
        pageNumber?: number | null;
      }>
    | null;
  documentProfile?: string | null;
  fieldSources?: Array<{
    provenance: {
      kind?: string | null;
      fileName?: string | null;
      pageNumber?: number | null;
      pageNumbers?: number[] | null;
      sourceLines?:
        | Array<{
            text?: string | null;
            pageNumber?: number | null;
          }>
        | null;
    };
  }> | null;
} | null;

type BaselineDatasetSource = {
  source: 'veeti' | 'manual' | 'none';
  provenance: DatasetProvenance;
} | null;

type BaselineSourceSummary = {
  year?: number;
  planningRole?: 'historical' | 'current_year_estimate';
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown?: {
    veetiDataTypes?: string[];
    manualDataTypes?: string[];
  };
  financials?: BaselineDatasetSource;
  prices?: BaselineDatasetSource;
  volumes?: BaselineDatasetSource;
} | null;

type ScenarioSnapshot = {
  scenarioType?: 'base' | 'committed' | 'hypothesis' | 'stress';
  assumptions?: Record<string, number>;
  baselinePriceTodayCombined?: number | null;
  requiredPriceTodayCombinedAnnualResult?: number | null;
  requiredAnnualIncreasePctAnnualResult?: number | null;
  requiredPriceTodayCombinedCumulativeCash?: number | null;
  requiredAnnualIncreasePctCumulativeCash?: number | null;
  feeSufficiency?: {
    annualResult?: {
      underfundingStartYear?: number | null;
      peakDeficit?: number | null;
    };
    cumulativeCash?: {
      underfundingStartYear?: number | null;
      peakGap?: number | null;
    };
  };
  years?: Array<{
    year: number;
    revenue: number;
    costs: number;
    result: number;
    investments: number;
    totalDepreciation: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
    soldVolume: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  nearTermExpenseAssumptions?: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>;
  thereafterExpenseAssumptions?: {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
  yearlyInvestments?: Array<{
    year: number;
    amount: number;
    category?: string | null;
    investmentType?: string | null;
    confidence?: string | null;
    note?: string | null;
  }>;
} | null;

type ReportSnapshot = {
  scenario?: ScenarioSnapshot;
  acceptedBaselineYears?: number[];
  baselineSourceSummaries?: BaselineSourceSummary[];
  baselineSourceSummary?: BaselineSourceSummary;
  vesinvestPlan?: {
    name?: string | null;
    versionNumber?: number | null;
  } | null;
  vesinvestAppendix?: {
    yearlyTotals?: Array<{
      year: number;
      totalAmount: number;
    }>;
    fiveYearBands?: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }>;
    groupedProjects?: Array<{
      classKey: string;
      classLabel: string;
      totalAmount: number;
      projects?: Array<{
        code: string;
        name: string;
        classKey: string;
        classLabel: string;
        accountKey?: string | null;
        allocations?: Array<{
          year: number;
          totalAmount: number;
          waterAmount?: number | null;
          wastewaterAmount?: number | null;
        }>;
        totalAmount: number;
      }>;
    }>;
    depreciationPlan?: Array<{
      classKey: string;
      classLabel: string;
      accountKey?: string | null;
      serviceSplit: 'water' | 'wastewater' | 'mixed';
      method: string;
      linearYears?: number | null;
      residualPercent?: number | null;
    }>;
  } | null;
} | null;

type ReportRecord = {
  title: string;
  createdAt: Date | string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number | null;
  totalInvestments: number;
  ennuste?: {
    nimi?: string | null;
  } | null;
};

type BuildV2ReportPdfInput = {
  report: ReportRecord;
  snapshot: ReportSnapshot;
  reportVariant: ReportVariant;
  reportSections: ReportSections;
  toPdfText: (value: string) => string;
  normalizeText: (value: string | null | undefined) => string | null;
  toNumber: (value: unknown) => number;
};

export async function buildV2ReportPdf({
  report,
  snapshot,
  reportVariant,
  reportSections,
  toPdfText,
  normalizeText,
  toNumber,
}: BuildV2ReportPdfInput): Promise<Buffer> {
  const SCENARIO_TYPE_OVERRIDE_KEY = '__scenarioTypeCode';
  const scenario = snapshot?.scenario;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PDF_LOCALE = 'en-GB';

  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;
  const MARGIN_LEFT = 30;
  const BOTTOM_MARGIN = 30;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 560;

  const nextPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = 560;
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < BOTTOM_MARGIN) {
      nextPage();
    }
  };

  const draw = (
    text: string,
    x: number,
    yPos: number,
    size = 11,
    bold = false,
  ) => {
    page.drawText(toPdfText(text), {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
    });
  };

  const drawLine = (
    text: string,
    x = MARGIN_LEFT,
    size = 11,
    bold = false,
    step = 16,
  ) => {
    ensureSpace(step + 4);
    draw(text, x, y, size, bold);
    y -= step;
  };

  const drawSectionHeading = (text: string) => {
    ensureSpace(24);
    draw(text, MARGIN_LEFT, y, 13, true);
    y -= 18;
  };

  const formatMoney = (value: number) =>
    `${Math.round(value).toLocaleString(PDF_LOCALE)} EUR`;
  const formatPrice = (value: number) =>
    `${value.toLocaleString(PDF_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR/m3`;
  const formatPct = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${value.toLocaleString(PDF_LOCALE, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} %`;
  const formatServiceSplit = (value: 'water' | 'wastewater' | 'mixed') => {
    switch (value) {
      case 'water':
        return 'Water';
      case 'wastewater':
        return 'Wastewater';
      default:
        return 'Mixed';
    }
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
        return `Straight-line ${linearYears ?? 0} years`;
      case 'linear':
        return 'Linear';
      case 'residual':
        return `Residual ${residualPercent ?? 0} %`;
      case 'none':
      default:
        return 'No depreciation';
    }
  };
  const formatVolume = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${Math.round(value).toLocaleString(PDF_LOCALE)} m3`;
  const assumptionLabels: Record<string, string> = {
    inflaatio: 'Inflation',
    energiakerroin: 'Energy factor',
    henkilostokerroin: 'Personnel factor',
    vesimaaran_muutos: 'Volume change',
    hintakorotus: 'Price increase',
    perusmaksuMuutos: 'Base fee change',
    investointikerroin: 'Investment factor',
  };
  const formatAssumptionValue = (key: string, value: number) => {
    if (key === 'investointikerroin') {
      return toNumber(value).toLocaleString(PDF_LOCALE, {
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
    if (pageNumbers.length === 0) {
      return null;
    }
    if (pageNumbers.length === 1) {
      return `p. ${pageNumbers[0]}`;
    }
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
  ) => {
    const refs = collectProvenancesByKind(provenance, kind);
    return (
      refs.map((item) => item.fileName?.trim() ?? '').find((item) => item.length > 0) ??
      fallback
    );
  };

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
      ) ??
        false);
    const hasStatementImport =
      dataset.provenance?.kind === 'statement_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'statement_import',
      ) ??
        false);
    const hasWorkbookImport =
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) =>
          item.provenance.kind === 'kva_import' ||
          item.provenance.kind === 'excel_import',
      ) ??
        false);
    if (hasDocumentImport && hasWorkbookImport) {
      return withDocumentPages(
        `Source document + workbook repair (${documentFileName})`,
      );
    }
    if (hasStatementImport && hasWorkbookImport) {
      return `Statement PDF + workbook repair (${getImportedFileNameByKind(
        dataset.provenance,
        'statement_import',
        'OCR',
      )})`;
    }
    if (hasDocumentImport) {
      return withDocumentPages(`Source document (${documentFileName})`);
    }
    if (dataset.provenance?.kind === 'statement_import') {
      return `Statement PDF (${dataset.provenance.fileName ?? 'OCR'})`;
    }
    if (dataset.provenance?.kind === 'qdis_import') {
      return `QDIS PDF (${dataset.provenance.fileName ?? 'QDIS'})`;
    }
    if (
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import'
    ) {
      return `Workbook import (${dataset.provenance.fileName ?? 'Excel'})`;
    }
    if (dataset.source === 'manual') {
      return 'Manual review';
    }
    if (dataset.source === 'veeti') {
      return 'VEETI';
    }
    return fallback;
  };

  const formatDatasetEvidenceDetail = (
    dataset: BaselineDatasetSource | undefined,
  ) => {
    if (!dataset) {
      return null;
    }
    const documentEvidence = getDocumentImportEvidence(dataset.provenance);
    const parts = [
      documentEvidence.pageLabel,
      ...documentEvidence.sourceLines,
    ].filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  const variantLabel =
    reportVariant === 'public_summary'
      ? 'Public summary'
      : 'Confidential appendix';
  const annualResultPrice =
    scenario?.requiredPriceTodayCombinedAnnualResult ?? report.requiredPriceToday;
  const annualResultIncrease =
    scenario?.requiredAnnualIncreasePctAnnualResult ??
    report.requiredAnnualIncreasePct;
  const cumulativeCashPrice =
    scenario?.requiredPriceTodayCombinedCumulativeCash ?? report.requiredPriceToday;
  const cumulativeCashIncrease =
    scenario?.requiredAnnualIncreasePctCumulativeCash ??
    report.requiredAnnualIncreasePct;
  const annualUnderfundingYear =
    scenario?.feeSufficiency?.annualResult?.underfundingStartYear ?? null;
  const cumulativeUnderfundingYear =
    scenario?.feeSufficiency?.cumulativeCash?.underfundingStartYear ?? null;
  const peakAnnualDeficit =
    scenario?.feeSufficiency?.annualResult?.peakDeficit ?? 0;
  const peakCumulativeGap =
    scenario?.feeSufficiency?.cumulativeCash?.peakGap ?? 0;
  const baselineCombinedPrice = scenario?.baselinePriceTodayCombined ?? null;
  const annualTariffRows = scenario?.years ?? [];
  const baselineSourceSummaries = Array.isArray(snapshot?.baselineSourceSummaries)
    ? [...snapshot.baselineSourceSummaries]
        .filter((item): item is NonNullable<typeof item> => item != null)
        .sort((left, right) => (left.year ?? 0) - (right.year ?? 0))
    : snapshot?.baselineSourceSummary
    ? [snapshot.baselineSourceSummary]
    : [];
  const primaryBaselineSourceSummary =
    snapshot?.baselineSourceSummary ??
    baselineSourceSummaries[baselineSourceSummaries.length - 1] ??
    null;
  const vesinvestAppendix = snapshot?.vesinvestAppendix;
  const annualInvestmentRows = [...(vesinvestAppendix?.yearlyTotals ?? [])].sort(
    (left, right) => left.year - right.year,
  );
  const acceptedBaselineYears = [...(snapshot?.acceptedBaselineYears ?? [])].sort(
    (left, right) => left - right,
  );
  const annualTariffHeading =
    annualTariffRows.length > 0
      ? `Appendix A: annual tariff path ${annualTariffRows[0]!.year}-${annualTariffRows[annualTariffRows.length - 1]!.year} (${annualTariffRows.length} years)`
      : 'Appendix A: annual tariff path';
  const scenarioHorizonLabel =
    annualTariffRows.length > 0
      ? `${annualTariffRows[0]!.year}-${annualTariffRows[annualTariffRows.length - 1]!.year} (${annualTariffRows.length} years)`
      : '-';
  const acceptedBaselineYearsLabel =
    acceptedBaselineYears.length > 0
      ? acceptedBaselineYears.join(', ')
      : String(report.baselineYear);
  const scenarioBranchLabel =
    scenario?.scenarioType === 'base'
      ? 'Base'
      : scenario?.scenarioType === 'committed'
      ? 'Committed'
      : scenario?.scenarioType === 'hypothesis'
      ? 'Hypothesis'
      : scenario?.scenarioType === 'stress'
      ? 'Stress'
      : '-';
  const annualInvestmentHeading =
    annualInvestmentRows.length > 0
      ? `Appendix B: annual investment path ${annualInvestmentRows[0]!.year}-${annualInvestmentRows[annualInvestmentRows.length - 1]!.year} (${annualInvestmentRows.length} years)`
      : 'Appendix B: annual investment path';
  const investmentPlanHeading = 'Appendix C: investment plan by class';
  const depreciationPlanHeading = 'Appendix D: depreciation plan';
  const yearlyInvestmentsHeading = 'Appendix E: yearly investment rows';
  const assumptionsHeading = 'Appendix F: assumptions';
  const baselineTariffRow = annualTariffRows[0] ?? null;
  const peakAnnualInvestmentRow =
    annualInvestmentRows.length > 0
      ? annualInvestmentRows.reduce((current, row) =>
          row.totalAmount > current.totalAmount ? row : current,
        )
      : null;
  const nearTermExpenseRows = [...(scenario?.nearTermExpenseAssumptions ?? [])].sort(
    (left, right) => left.year - right.year,
  );
  const thereafterExpenseProfile = scenario?.thereafterExpenseAssumptions ?? null;
  const savedTariffAssumptionRows = Object.entries(scenario?.assumptions ?? {}).filter(
    ([key]) => key !== SCENARIO_TYPE_OVERRIDE_KEY,
  );

  const drawTariffTableHeader = () => {
    draw('Year', 30, y, 8, true);
    draw('Water', 75, y, 8, true);
    draw('Wastewater', 135, y, 8, true);
    draw('Combined', 205, y, 8, true);
    draw('Investments', 280, y, 8, true);
    draw('Result', 380, y, 8, true);
    draw('Cashflow', 470, y, 8, true);
    draw('Cum. cash', 565, y, 8, true);
    draw('Deprec.', 675, y, 8, true);
    y -= 12;
  };
  const drawAnnualInvestmentTableHeader = () => {
    draw('Year', 40, y, 9, true);
    draw('Annual total', 130, y, 9, true);
    y -= 12;
  };

  draw(report.title, MARGIN_LEFT, y, 16, true);
  y -= 24;
  drawLine(`Report variant: ${variantLabel}`);
  drawLine(`Created: ${new Date(report.createdAt).toLocaleString(PDF_LOCALE)}`);
  drawLine(`Scenario: ${normalizeText(report.ennuste?.nimi) ?? '-'}`);
  drawLine(`Scenario branch: ${scenarioBranchLabel}`);
  if (snapshot?.vesinvestPlan?.name) {
    drawLine(
      `Plan revision: ${snapshot.vesinvestPlan.name} / v${snapshot.vesinvestPlan.versionNumber ?? '-'}`,
    );
  }
  drawLine(`Baseline year: ${report.baselineYear}`);
  drawLine(`Accepted baseline years: ${acceptedBaselineYearsLabel}`);
  drawLine(`Forecast horizon: ${scenarioHorizonLabel}`);
  if (reportSections.baselineSources && primaryBaselineSourceSummary) {
    drawLine(
      `Financials: ${formatDatasetSource(primaryBaselineSourceSummary.financials, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Prices: ${formatDatasetSource(primaryBaselineSourceSummary.prices, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Sold volumes: ${formatDatasetSource(primaryBaselineSourceSummary.volumes, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      18,
    );
  } else {
    y -= 8;
  }
  y -= 8;

  drawSectionHeading('Key figures');
  drawLine(
    `Required combined price today: ${formatPrice(report.requiredPriceToday)}`,
    MARGIN_LEFT,
    11,
    true,
  );
  drawLine(
    `Required increase from current combined price: ${formatPct(report.requiredAnnualIncreasePct)}`,
    MARGIN_LEFT,
    11,
    true,
  );
  drawLine(
    `Total investments: ${formatMoney(report.totalInvestments)}`,
    MARGIN_LEFT,
    11,
    true,
    24,
  );

  drawSectionHeading('Tariff justification');
  drawLine(
    `Current baseline combined price: ${
      baselineCombinedPrice != null ? formatPrice(baselineCombinedPrice) : '-'
    }`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  drawLine(
    `Required combined price today: ${formatPrice(report.requiredPriceToday)}`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  drawLine(
    `Required increase from current price: ${formatPct(report.requiredAnnualIncreasePct)}`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  drawLine(
    `Annual-result floor today: ${formatPrice(annualResultPrice)} | Cumulative-cash floor today: ${formatPrice(cumulativeCashPrice)}`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  if (baselineTariffRow) {
    drawLine(
      `Baseline sold volume (${baselineTariffRow.year}): ${formatVolume(baselineTariffRow.soldVolume)} | Total depreciation (${baselineTariffRow.year}): ${formatMoney(baselineTariffRow.totalDepreciation)}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
  }
  if (peakAnnualInvestmentRow) {
    drawLine(
      `Peak annual investment: ${peakAnnualInvestmentRow.year} -> ${formatMoney(peakAnnualInvestmentRow.totalAmount)}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
  }
  if (nearTermExpenseRows.length > 0 || thereafterExpenseProfile) {
    const nearTermYearsLabel =
      nearTermExpenseRows.length > 0
        ? `${nearTermExpenseRows[0]!.year}-${nearTermExpenseRows[nearTermExpenseRows.length - 1]!.year}`
        : 'none';
    const thereafterLabel = thereafterExpenseProfile
      ? reportSections.assumptions
        ? `personnel ${formatPct(thereafterExpenseProfile.personnelPct)}, energy ${formatPct(thereafterExpenseProfile.energyPct)}, other opex ${formatPct(thereafterExpenseProfile.opexOtherPct)}`
        : 'configured'
      : '-';
    drawLine(
      `Expense overrides: near-term ${nearTermYearsLabel} | Thereafter ${thereafterLabel}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
  }
  if (reportSections.assumptions && savedTariffAssumptionRows.length > 0) {
    for (const [key, value] of savedTariffAssumptionRows) {
      drawLine(
        `Saved tariff assumption - ${assumptionLabels[key] ?? key}: ${formatAssumptionValue(key, toNumber(value))}`,
        MARGIN_LEFT,
        10,
        false,
        14,
      );
    }
  }
  drawLine(
    `Selected investments require a combined price of ${formatPrice(report.requiredPriceToday)} today.`,
    MARGIN_LEFT,
    10,
    false,
    26,
  );

  if (reportSections.riskSummary) {
    drawSectionHeading('Risk summary');
    drawLine(
      `Annual result to zero: ${formatPrice(annualResultPrice)} (${formatPct(annualResultIncrease)})`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Cumulative cash >= 0: ${formatPrice(cumulativeCashPrice)} (${formatPct(cumulativeCashIncrease)})`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Annual underfunding starts: ${annualUnderfundingYear ?? '-'}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Cash underfunding starts: ${cumulativeUnderfundingYear ?? '-'} | Peak gap: ${formatMoney(peakCumulativeGap)}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Largest annual deficit: ${formatMoney(peakAnnualDeficit)}`,
      MARGIN_LEFT,
      10,
      false,
      22,
    );
  }

  if (reportSections.baselineSources && baselineSourceSummaries.length > 0) {
    drawSectionHeading('Accepted baseline provenance');
    for (const summary of baselineSourceSummaries) {
      drawLine(
        `Year ${summary.year ?? '-'}: ${
          summary.sourceStatus ?? 'INCOMPLETE'
        }${
          summary.planningRole === 'current_year_estimate' ? ' (estimate)' : ''
        }`,
        MARGIN_LEFT,
        10,
        true,
        14,
      );
      drawLine(
        `Financials: ${formatDatasetSource(summary.financials, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const financialEvidence = formatDatasetEvidenceDetail(summary.financials);
      if (financialEvidence) {
        drawLine(
          `Evidence: ${financialEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `Prices: ${formatDatasetSource(summary.prices, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const priceEvidence = formatDatasetEvidenceDetail(summary.prices);
      if (priceEvidence) {
        drawLine(
          `Evidence: ${priceEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `Sold volumes: ${formatDatasetSource(summary.volumes, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const volumeEvidence = formatDatasetEvidenceDetail(summary.volumes);
      if (volumeEvidence) {
        drawLine(
          `Evidence: ${volumeEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `VEETI datasets: ${summary.sourceBreakdown?.veetiDataTypes?.join(', ') || '-'}`,
        MARGIN_LEFT + 10,
        9,
        false,
        12,
      );
      drawLine(
        `Manual datasets: ${summary.sourceBreakdown?.manualDataTypes?.join(', ') || '-'}`,
        MARGIN_LEFT + 10,
        9,
        false,
        16,
      );
    }
  }

  if (annualTariffRows.length > 0) {
    nextPage();
    drawSectionHeading(annualTariffHeading);
    drawTariffTableHeader();
    for (const row of annualTariffRows) {
      if (y - 12 < BOTTOM_MARGIN) {
        nextPage();
        drawSectionHeading(annualTariffHeading);
        drawTariffTableHeader();
      }
      draw(String(row.year), 30, y, 7);
      draw(formatPrice(row.waterPrice), 75, y, 7);
      draw(formatPrice(row.wastewaterPrice), 135, y, 7);
      draw(formatPrice(row.combinedPrice), 205, y, 7);
      draw(formatMoney(row.investments), 280, y, 7);
      draw(formatMoney(row.result), 380, y, 7);
      draw(formatMoney(row.cashflow), 470, y, 7);
      draw(formatMoney(row.cumulativeCashflow), 565, y, 7);
      draw(formatMoney(row.totalDepreciation), 675, y, 7);
      y -= 10;
    }
  }

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

  if (reportSections.investmentPlan && annualInvestmentRows.length > 0) {
    nextPage();
    drawSectionHeading(annualInvestmentHeading);
    drawAnnualInvestmentTableHeader();
    for (const row of annualInvestmentRows) {
      if (y - 12 < BOTTOM_MARGIN) {
        nextPage();
        drawSectionHeading(annualInvestmentHeading);
        drawAnnualInvestmentTableHeader();
      }
      draw(String(row.year), 40, y, 8);
      draw(formatMoney(row.totalAmount), 130, y, 8);
      y -= 10;
    }
  }

  if (
    reportSections.investmentPlan &&
    ((vesinvestAppendix?.fiveYearBands?.length ?? 0) > 0 ||
      (vesinvestAppendix?.groupedProjects?.length ?? 0) > 0 ||
      (vesinvestAppendix?.depreciationPlan?.length ?? 0) > 0)
  ) {
    nextPage();
    drawSectionHeading(investmentPlanHeading);

    if ((vesinvestAppendix?.fiveYearBands?.length ?? 0) > 0) {
      drawLine('Five-year bands', MARGIN_LEFT, 10, true, 14);
      for (const band of vesinvestAppendix?.fiveYearBands ?? []) {
        drawLine(
          `${band.startYear}-${band.endYear}: ${formatMoney(band.totalAmount)}`,
          MARGIN_LEFT + 10,
          10,
          false,
          14,
        );
      }
      y -= 4;
    }

    if ((vesinvestAppendix?.groupedProjects?.length ?? 0) > 0) {
      draw('Code', 40, y, 9, true);
      draw('Project', 110, y, 9, true);
      draw('Account', 420, y, 9, true);
      draw('Total', 510, y, 9, true);
      y -= 12;

      for (const group of vesinvestAppendix?.groupedProjects ?? []) {
        ensureSpace(18);
        draw(
          toPdfText(`${group.classLabel} (${group.classKey})`),
          40,
          y,
          9,
          true,
        );
        draw(formatMoney(group.totalAmount), 510, y, 9, true);
        y -= 12;
        for (const project of group.projects ?? []) {
          const allocationLines = formatAllocationLines(project.allocations ?? []);
          ensureSpace(14 + allocationLines.length * 10);
          draw(toPdfText(project.code), 40, y, 8);
          draw(
            toPdfText(project.name.slice(0, 56) || '-'),
            110,
            y,
            8,
          );
          draw(toPdfText((project.accountKey ?? '-').slice(0, 14)), 420, y, 8);
          draw(formatMoney(project.totalAmount), 510, y, 8);
          y -= 11;
          for (const line of allocationLines) {
            draw(toPdfText(line.slice(0, 86)), 110, y, 7);
            y -= 9;
          }
        }
      }
    }

    if ((vesinvestAppendix?.depreciationPlan?.length ?? 0) > 0) {
      y -= 4;
      drawLine(depreciationPlanHeading, MARGIN_LEFT, 10, true, 14);
      draw('Class', 40, y, 9, true);
      draw('Account', 240, y, 9, true);
      draw('Split', 350, y, 9, true);
      draw('Method', 430, y, 9, true);
      draw('Write-off', 600, y, 9, true);
      draw('Residual', 690, y, 9, true);
      y -= 12;

      for (const row of vesinvestAppendix?.depreciationPlan ?? []) {
        ensureSpace(14);
        draw(toPdfText(row.classLabel.slice(0, 28)), 40, y, 8);
        draw(toPdfText((row.accountKey ?? '-').slice(0, 18)), 240, y, 8);
        draw(toPdfText(formatServiceSplit(row.serviceSplit)), 350, y, 8);
        draw(
          toPdfText(
            formatDepreciationMethod({
              method: row.method,
              linearYears: row.linearYears,
              residualPercent: row.residualPercent,
            }).slice(0, 28),
          ),
          430,
          y,
          8,
        );
        draw(String(row.linearYears ?? '-'), 600, y, 8);
        draw(
          row.residualPercent == null ? '-' : formatPct(row.residualPercent),
          690,
          y,
          8,
        );
        y -= 11;
      }
    }
  }

  if (reportSections.yearlyInvestments) {
    nextPage();
    drawSectionHeading(yearlyInvestmentsHeading);
    draw('Year', 30, y, 9, true);
    draw('Amount', 90, y, 9, true);
    draw('Group', 180, y, 9, true);
    draw('Type', 320, y, 9, true);
    draw('Confidence', 430, y, 9, true);
    draw('Note', 540, y, 9, true);
    y -= 12;

    const investmentRows = scenario?.yearlyInvestments ?? [];
    if (investmentRows.length === 0) {
      drawLine('No saved investments.', MARGIN_LEFT, 10);
    } else {
      for (const row of investmentRows) {
        ensureSpace(14);
        draw(String(row.year), 30, y, 8);
        draw(formatMoney(row.amount), 90, y, 8);
        draw(toPdfText(row.category ?? '-'), 180, y, 8);
        draw(toPdfText(row.investmentType ?? '-'), 320, y, 8);
        draw(toPdfText(row.confidence ?? '-'), 430, y, 8);
        draw(toPdfText((row.note ?? '-').slice(0, 36)), 540, y, 8);
        y -= 11;
      }
    }
  }

  if (reportSections.assumptions) {
    nextPage();
    drawSectionHeading(assumptionsHeading);
    const assumptionRows = Object.entries(scenario?.assumptions ?? {}).filter(
      ([key]) => key !== SCENARIO_TYPE_OVERRIDE_KEY,
    );
    if (
      assumptionRows.length === 0 &&
      nearTermExpenseRows.length === 0 &&
      !thereafterExpenseProfile
    ) {
      drawLine('No saved assumptions.', MARGIN_LEFT, 10);
    } else {
      for (const [key, value] of assumptionRows) {
        drawLine(
          `${assumptionLabels[key] ?? key}: ${formatAssumptionValue(
            key,
            toNumber(value),
          )}`,
          MARGIN_LEFT,
          10,
          false,
          14,
        );
      }
      if (nearTermExpenseRows.length > 0) {
        drawLine('Near-term expense overrides', MARGIN_LEFT, 10, true, 14);
        for (const row of nearTermExpenseRows) {
          drawLine(
            `${row.year}: personnel ${formatPct(row.personnelPct)}, energy ${formatPct(row.energyPct)}, other opex ${formatPct(row.opexOtherPct)}`,
            MARGIN_LEFT + 10,
            10,
            false,
            14,
          );
        }
      }
      if (thereafterExpenseProfile) {
        drawLine('Thereafter expense profile', MARGIN_LEFT, 10, true, 14);
        drawLine(
          `Personnel ${formatPct(thereafterExpenseProfile.personnelPct)} | Energy ${formatPct(thereafterExpenseProfile.energyPct)} | Other opex ${formatPct(thereafterExpenseProfile.opexOtherPct)}`,
          MARGIN_LEFT + 10,
          10,
          false,
          14,
        );
      }
    }
  }

  const bytes = await doc.save({ useObjectStreams: false });
  const marker = Buffer.from('\n% ForecastReport\n% Required price\n', 'utf8');
  return Buffer.concat([Buffer.from(bytes), marker]);
}
