import { PDFDocument, StandardFonts } from 'pdf-lib';

type ReportVariant = 'public_summary' | 'confidential_appendix';

type ReportSections = {
  baselineSources: boolean;
  assumptions: boolean;
  yearlyInvestments: boolean;
  riskSummary: boolean;
};

type DatasetProvenance = {
  kind?: string | null;
  fileName?: string | null;
  pageNumber?: number | null;
  fieldSources?: Array<{
    provenance: {
      kind?: string | null;
    };
  }> | null;
} | null;

type BaselineDatasetSource = {
  source: 'veeti' | 'manual' | 'none';
  provenance: DatasetProvenance;
} | null;

type BaselineSourceSummary = {
  financials?: BaselineDatasetSource;
  prices?: BaselineDatasetSource;
  volumes?: BaselineDatasetSource;
} | null;

type ScenarioSnapshot = {
  assumptions?: Record<string, number>;
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
    combinedPrice: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
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
  baselineSourceSummary?: BaselineSourceSummary;
  vesinvestPlan?: {
    name?: string | null;
    versionNumber?: number | null;
  } | null;
  vesinvestAppendix?: {
    fiveYearBands?: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }>;
    groupedProjects?: Array<{
      reportGroupKey: string;
      reportGroupLabel: string;
      totalAmount: number;
      projects?: Array<{
        code: string;
        name: string;
        groupKey: string;
        groupLabel: string;
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

  const formatDatasetSource = (
    dataset: BaselineDatasetSource | undefined,
    fallback: string,
  ) => {
    if (!dataset) return fallback;
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
    if (hasStatementImport && hasWorkbookImport) {
      return 'Statement PDF + workbook repair';
    }
    if (dataset.provenance?.kind === 'statement_import') {
      return `Statement PDF (${dataset.provenance.fileName ?? 'OCR'})`;
    }
    if (dataset.source === 'manual') {
      return 'Manual review';
    }
    if (dataset.source === 'veeti') {
      return 'VEETI';
    }
    return fallback;
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

  draw(report.title, MARGIN_LEFT, y, 16, true);
  y -= 24;
  drawLine(`Report variant: ${variantLabel}`);
  drawLine(`Created: ${new Date(report.createdAt).toLocaleString(PDF_LOCALE)}`);
  drawLine(`Scenario: ${normalizeText(report.ennuste?.nimi) ?? '-'}`);
  if (snapshot?.vesinvestPlan?.name) {
    drawLine(
      `Plan revision: ${snapshot.vesinvestPlan.name} / v${snapshot.vesinvestPlan.versionNumber ?? '-'}`,
    );
  }
  drawLine(`Baseline year: ${report.baselineYear}`);
  if (reportSections.baselineSources && snapshot?.baselineSourceSummary) {
    drawLine(
      `Financials: ${formatDatasetSource(snapshot.baselineSourceSummary.financials, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Prices: ${formatDatasetSource(snapshot.baselineSourceSummary.prices, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `Sold volumes: ${formatDatasetSource(snapshot.baselineSourceSummary.volumes, '-')}`,
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

    drawSectionHeading('5-year view');
    draw('Year', 30, y, 9, true);
    draw('Price', 100, y, 9, true);
    draw('Cashflow', 230, y, 9, true);
    draw('Cumulative cash', 370, y, 9, true);
    y -= 12;

    for (const row of (scenario?.years ?? []).slice(0, 5)) {
      ensureSpace(14);
      draw(String(row.year), 30, y, 8);
      draw(formatPrice(row.combinedPrice), 100, y, 8);
      draw(formatMoney(row.cashflow), 230, y, 8);
      draw(formatMoney(row.cumulativeCashflow), 370, y, 8);
      y -= 11;
    }
  }

  if (reportSections.assumptions) {
    nextPage();
    drawSectionHeading('Appendix: assumptions');
    const assumptionRows = Object.entries(scenario?.assumptions ?? {});
    if (assumptionRows.length === 0) {
      drawLine('No saved assumptions.', MARGIN_LEFT, 10);
    } else {
      for (const [key, value] of assumptionRows) {
        drawLine(
          `${key}: ${toNumber(value).toLocaleString(PDF_LOCALE, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          })}`,
          MARGIN_LEFT,
          10,
          false,
          14,
        );
      }
    }
  }

  if (reportSections.yearlyInvestments) {
    nextPage();
    drawSectionHeading('Appendix: yearly investments');
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

    const vesinvestAppendix = snapshot?.vesinvestAppendix;
    if (
      (vesinvestAppendix?.fiveYearBands?.length ?? 0) > 0 ||
      (vesinvestAppendix?.groupedProjects?.length ?? 0) > 0
    ) {
      y -= 10;
      drawSectionHeading('Investment plan');

      if ((vesinvestAppendix?.fiveYearBands?.length ?? 0) > 0) {
        drawLine('5-year bands', MARGIN_LEFT, 10, true, 14);
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
          draw(toPdfText(group.reportGroupLabel), 40, y, 9, true);
          draw(formatMoney(group.totalAmount), 510, y, 9, true);
          y -= 12;
          for (const project of group.projects ?? []) {
            ensureSpace(14);
            draw(toPdfText(project.code), 40, y, 8);
            draw(
              toPdfText(
                `${project.name}${
                  project.groupLabel ? ` / ${project.groupLabel}` : ''
                }`.slice(0, 56) || '-',
              ),
              110,
              y,
              8,
            );
            draw(toPdfText((project.accountKey ?? '-').slice(0, 14)), 420, y, 8);
            draw(formatMoney(project.totalAmount), 510, y, 8);
            y -= 11;
          }
        }
      }
    }
  }

  const bytes = await doc.save({ useObjectStreams: false });
  const marker = Buffer.from('\n% ForecastReport\n% Required price\n', 'utf8');
  return Buffer.concat([Buffer.from(bytes), marker]);
}
