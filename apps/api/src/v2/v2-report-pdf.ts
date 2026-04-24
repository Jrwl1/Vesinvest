import { PDFDocument,StandardFonts } from 'pdf-lib';
import {
  createPdfReportSupport,
  formatAcceptedBaselineYears,
  normalizeVesinvestClassLabel,
} from './v2-report-pdf-support';
import type { BuildV2ReportPdfInput } from './v2-report-pdf.types';

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

  const {
    assumptionLabels,
    formatAllocationLines,
    formatAssumptionValue,
    formatDatasetEvidenceDetail,
    formatDatasetSource,
    formatDepreciationMethod,
    formatMoney,
    formatPct,
    formatPrice,
    formatServiceSplit,
    formatVolume,
  } = createPdfReportSupport({
    toPdfText,
    normalizeText,
    toNumber,
    pdfLocale: PDF_LOCALE,
  });

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
  const annualTariffHeading =
    annualTariffRows.length > 0
      ? `Appendix A: annual tariff path ${annualTariffRows[0]!.year}-${annualTariffRows[annualTariffRows.length - 1]!.year} (${annualTariffRows.length} years)`
      : 'Appendix A: annual tariff path';
  const scenarioHorizonLabel =
    annualTariffRows.length > 0
      ? `${annualTariffRows[0]!.year}-${annualTariffRows[annualTariffRows.length - 1]!.year} (${annualTariffRows.length} years)`
      : '-';
  const acceptedBaselineYearsLabel = formatAcceptedBaselineYears(snapshot);
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
  const showDetailedInvestmentAppendices = reportSections.yearlyInvestments;
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
  const acceptedTariffPlan = snapshot?.tariffPlan ?? null;
  const acceptedTariffFees = acceptedTariffPlan?.recommendation?.fees ?? {};
  const tariffFeeLabels: Record<string, string> = {
    connectionFee: 'Connection fee',
    baseFee: 'Base fee',
    waterUsageFee: 'Water usage fee',
    wastewaterUsageFee: 'Wastewater usage fee',
  };
  const formatTariffUnit = (key: string, value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) {
      return '-';
    }
    return key === 'waterUsageFee' || key === 'wastewaterUsageFee'
      ? formatPrice(value)
      : formatMoney(value);
  };

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
  if (acceptedTariffPlan?.recommendation) {
    drawLine(
      `Accepted tariff package: ${formatMoney(acceptedTariffPlan.recommendation.proposedAnnualRevenue ?? 0)} annual revenue after ${acceptedTariffPlan.recommendation.smoothingYears ?? '-'} years.`,
      MARGIN_LEFT,
      10,
      true,
      14,
    );
    drawLine(
      `Average annual customer impact: ${formatPct(acceptedTariffPlan.recommendation.averageAnnualIncreasePct ?? null)} | 15% status: ${acceptedTariffPlan.recommendation.lawReadiness?.smoothingStatus ?? '-'}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    for (const [key, fee] of Object.entries(acceptedTariffFees)) {
      drawLine(
        `${tariffFeeLabels[key] ?? key}: ${formatTariffUnit(
          key,
          fee.currentUnit,
        )} -> ${formatTariffUnit(key, fee.proposedUnit)} | impact ${formatMoney(fee.revenueImpact ?? 0)}`,
        MARGIN_LEFT,
        10,
        false,
        14,
      );
    }
  }

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


  if (
    reportSections.investmentPlan &&
    showDetailedInvestmentAppendices &&
    annualInvestmentRows.length > 0
  ) {
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
      (showDetailedInvestmentAppendices &&
        (vesinvestAppendix?.depreciationPlan?.length ?? 0) > 0))
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
      if (showDetailedInvestmentAppendices) {
        draw('Code', 40, y, 9, true);
        draw('Project', 110, y, 9, true);
        draw('Account', 420, y, 9, true);
        draw('Total', 510, y, 9, true);
        y -= 12;

        for (const group of vesinvestAppendix?.groupedProjects ?? []) {
          ensureSpace(18);
          draw(
            toPdfText(
              `${normalizeVesinvestClassLabel(group.classKey, group.classLabel)} (${group.classKey})`,
            ),
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
      } else {
        draw('Class', 40, y, 9, true);
        draw('Total', 510, y, 9, true);
        y -= 12;

        for (const group of vesinvestAppendix?.groupedProjects ?? []) {
          ensureSpace(14);
          draw(
            toPdfText(
              `${normalizeVesinvestClassLabel(group.classKey, group.classLabel)} (${group.classKey})`,
            ),
            40,
            y,
            8,
          );
          draw(formatMoney(group.totalAmount), 510, y, 8);
          y -= 11;
        }
      }
    }

    if (
      showDetailedInvestmentAppendices &&
      (vesinvestAppendix?.depreciationPlan?.length ?? 0) > 0
    ) {
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
        draw(
          toPdfText(
            normalizeVesinvestClassLabel(row.classKey, row.classLabel).slice(0, 28),
          ),
          40,
          y,
          8,
        );
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
