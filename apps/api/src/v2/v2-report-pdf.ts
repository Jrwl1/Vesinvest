import { PDFDocument,StandardFonts } from 'pdf-lib';
import {
  createPdfReportSupport,
  formatAcceptedBaselineYears,
  normalizeVesinvestClassLabel,
} from './v2-report-pdf-support';
import type { BuildV2ReportPdfInput } from './v2-report-pdf.types';

type PdfReportLocale = 'en' | 'fi' | 'sv';

const PDF_DATE_LOCALES: Record<PdfReportLocale, string> = {
  en: 'en-GB',
  fi: 'fi-FI',
  sv: 'sv-SE',
};

const PDF_LABELS: Record<
  PdfReportLocale,
  {
    reportVariant: string;
    variants: Record<'regulator_package' | 'board_package' | 'internal_appendix', string>;
  }
> = {
  en: {
    reportVariant: 'Report variant',
    variants: {
      regulator_package: 'Regulator package',
      board_package: 'Board package',
      internal_appendix: 'Internal appendix',
    },
  },
  fi: {
    reportVariant: 'Raporttiversio',
    variants: {
      regulator_package: 'Viranomaispaketti',
      board_package: 'Hallituksen paketti',
      internal_appendix: 'Sisäinen liite',
    },
  },
  sv: {
    reportVariant: 'Rapportvariant',
    variants: {
      regulator_package: 'Myndighetspaket',
      board_package: 'Styrelsepaket',
      internal_appendix: 'Intern bilaga',
    },
  },
};

function normalizePdfReportLocale(
  raw: string | null | undefined,
  reportTitle: string | null | undefined,
): PdfReportLocale {
  if (raw === 'fi' || raw === 'sv' || raw === 'en') return raw;
  const title = reportTitle?.trim().toLowerCase() ?? '';
  if (title.startsWith('ennusteraportti ')) return 'fi';
  if (title.startsWith('prognosrapport ')) return 'sv';
  return 'en';
}

function createPdfCopy(locale: PdfReportLocale) {
  const en = {
    created: 'Created',
    scenario: 'Scenario',
    scenarioBranches: {
      base: 'Base',
      committed: 'Committed',
      hypothesis: 'Hypothesis',
      stress: 'Stress',
    },
    scenarioBranch: 'Scenario branch',
    planRevision: 'Plan revision',
    baselineYear: 'Baseline year',
    acceptedBaselineYears: 'Accepted baseline years',
    forecastHorizon: 'Forecast horizon',
    financials: 'Financials',
    prices: 'Prices',
    soldVolumes: 'Sold volumes',
    keyFigures: 'Key figures',
    requiredCombinedPriceToday: 'Required combined price today',
    requiredIncreaseFromCurrentCombinedPrice:
      'Required increase from current combined price',
    totalInvestments: 'Total investments',
    tariffJustification: 'Tariff justification',
    currentBaselineCombinedPrice: 'Current baseline combined price',
    requiredIncreaseFromCurrentPrice: 'Required increase from current price',
    baselineSoldVolume: 'Baseline sold volume',
    totalDepreciation: 'Total depreciation',
    peakAnnualInvestment: 'Peak annual investment',
    expenseOverrides: 'Expense overrides',
    nearTerm: 'near-term',
    none: 'none',
    thereafter: 'Thereafter',
    configured: 'configured',
    selectedInvestmentsRequire: (price: string) =>
      `Selected investments require a combined price of ${price} today.`,
    acceptedTariffPackage: (revenue: string, years: string | number) =>
      `Accepted tariff package: ${revenue} annual revenue after ${years} years.`,
    averageAnnualCustomerImpact: 'Average annual customer impact',
    smoothingStatus15: '15% status',
    feeLabels: {
      connectionFee: 'Connection fee',
      baseFee: 'Base fee',
      waterUsageFee: 'Water usage fee',
      wastewaterUsageFee: 'Wastewater usage fee',
    },
    impact: 'impact',
    internalEvidenceAppendix: 'Internal evidence appendix',
    evidenceLabels: {
      assetInventory: 'Asset inventory',
      conditionStudies: 'Condition studies',
      maintenance: 'Maintenance',
      municipalContext: 'Municipal context',
      financialRisk: 'Financial risk',
      publicationBoundary: 'Publication boundary',
      communication: 'Communication',
      tariffRevenue: 'Tariff revenue',
      tariffCosts: 'Tariff costs',
      regionalDifferentiation: 'Regional differentiation',
      stormwater: 'Stormwater',
      specialUse: 'Special use',
      connectionFeeLiability: 'Connection-fee liability',
      ownerDistribution: 'Owner distribution',
    },
    riskSummary: 'Risk summary',
    annualResultToZero: 'Annual result to zero',
    cumulativeCashFloor: 'Cumulative cash floor',
    annualUnderfundingStarts: 'Annual underfunding starts',
    cashUnderfundingStarts: 'Cash underfunding starts',
    peakGap: 'Peak gap',
    largestAnnualDeficit: 'Largest annual deficit',
    acceptedBaselineProvenance: 'Accepted baseline provenance',
    year: 'Year',
    estimate: 'estimate',
    evidence: 'Evidence',
    veetiDatasets: 'VEETI sources',
    manualDatasets: 'Manual sources',
    appendixAnnualTariffPath: 'Appendix A: annual tariff path',
    appendixAnnualInvestmentPath: 'Appendix B: annual investment path',
    appendixInvestmentPlanByClass: 'Appendix C: investment plan by class',
    appendixDepreciationPlan: 'Appendix D: depreciation plan',
    appendixYearlyInvestmentRows: 'Appendix E: yearly investment rows',
    appendixAssumptions: 'Appendix F: assumptions',
    table: {
      year: 'Year',
      water: 'Water',
      wastewater: 'Wastewater',
      combined: 'Combined',
      investments: 'Investments',
      result: 'Result',
      cashflow: 'Cashflow',
      cumulativeCash: 'Cum. cash',
      depreciation: 'Deprec.',
      annualTotal: 'Annual total',
      fiveYearBands: 'Five-year bands',
      code: 'Code',
      project: 'Project',
      account: 'Account',
      total: 'Total',
      class: 'Class',
      split: 'Split',
      method: 'Method',
      writeOff: 'Write-off',
      residual: 'Residual',
      amount: 'Amount',
      group: 'Group',
      type: 'Type',
      confidence: 'Confidence',
      note: 'Note',
    },
    noSavedInvestments: 'No saved investments.',
    noSavedAssumptions: 'No saved assumptions.',
    nearTermExpenseOverrides: 'Near-term expense overrides',
    thereafterExpenseProfile: 'Thereafter expense profile',
    personnel: 'personnel',
    energy: 'energy',
    otherOpex: 'other opex',
    savedTariffAssumption: 'Saved tariff assumption',
  };
  if (locale === 'fi') {
    return {
      ...en,
      created: 'Luotu',
      scenario: 'Skenaario',
      scenarioBranches: {
        base: 'Perus',
        committed: 'Paatetty',
        hypothesis: 'Oletus',
        stress: 'Stressi',
      },
      scenarioBranch: 'Skenaariotyyppi',
      planRevision: 'Suunnitelmarevisio',
      baselineYear: 'Perusvuosi',
      acceptedBaselineYears: 'Hyvaksytyt perusvuodet',
      forecastHorizon: 'Ennustehorisontti',
      financials: 'Talous',
      prices: 'Hinnat',
      soldVolumes: 'Myydyt volyymit',
      keyFigures: 'Avainluvut',
      requiredCombinedPriceToday: 'Tarvittava yhdistetty hinta tanaan',
      requiredIncreaseFromCurrentCombinedPrice:
        'Tarvittava korotus nykyiseen yhdistettyyn hintaan',
      totalInvestments: 'Investoinnit yhteensa',
      tariffJustification: 'Maksuperustelu',
      currentBaselineCombinedPrice: 'Nykyinen yhdistetty perushinta',
      requiredIncreaseFromCurrentPrice: 'Tarvittava korotus nykyhintaan',
      baselineSoldVolume: 'Perusvuoden myyty volyymi',
      totalDepreciation: 'Poistot yhteensa',
      peakAnnualInvestment: 'Suurin vuosittainen investointi',
      expenseOverrides: 'Kustannusoletukset',
      nearTerm: 'lahivuodet',
      none: 'ei ole',
      thereafter: 'Sen jalkeen',
      configured: 'maaritetty',
      selectedInvestmentsRequire: (price: string) =>
        `Valitut investoinnit edellyttavat yhdistettya hintaa ${price} tanaan.`,
      acceptedTariffPackage: (revenue: string, years: string | number) =>
        `Hyvaksytty maksupaketti: ${revenue} vuosituotto ${years} vuoden jalkeen.`,
      averageAnnualCustomerImpact: 'Keskimaarainen vuosittainen asiakasvaikutus',
      smoothingStatus15: '15 % tila',
      feeLabels: {
        connectionFee: 'Liittymismaksu',
        baseFee: 'Perusmaksu',
        waterUsageFee: 'Vesimaksu',
        wastewaterUsageFee: 'Jatevesimaksu',
      },
      impact: 'vaikutus',
      internalEvidenceAppendix: 'Sisainen evidenssiliite',
      evidenceLabels: {
        assetInventory: 'Omaisuusluettelo',
        conditionStudies: 'Kuntotutkimukset',
        maintenance: 'Kunnossapito',
        municipalContext: 'Kunnan konteksti',
        financialRisk: 'Talousriski',
        publicationBoundary: 'Julkaisurajaus',
        communication: 'Viestinta',
        tariffRevenue: 'Maksutuotot',
        tariffCosts: 'Maksukustannukset',
        regionalDifferentiation: 'Alueellinen eriyttaminen',
        stormwater: 'Hulevesi',
        specialUse: 'Erityiskaytto',
        connectionFeeLiability: 'Liittymismaksuvelka',
        ownerDistribution: 'Omistajajako',
      },
      riskSummary: 'Riskikooste',
      annualResultToZero: 'Vuosikatteen nollataso',
      cumulativeCashFloor: 'Kumulatiivinen kassataso',
      annualUnderfundingStarts: 'Vuositason alirahoitus alkaa',
      cashUnderfundingStarts: 'Kassaalirahoitus alkaa',
      peakGap: 'Suurin vaje',
      largestAnnualDeficit: 'Suurin vuosivaje',
      acceptedBaselineProvenance: 'Hyvaksytyn perusaineiston provenienssi',
      year: 'Vuosi',
      estimate: 'arvio',
      evidence: 'Evidenssi',
      veetiDatasets: 'VEETI-lähteet',
      manualDatasets: 'Manuaaliset lähteet',
      appendixAnnualTariffPath: 'Liite A: vuosittainen maksupolku',
      appendixAnnualInvestmentPath: 'Liite B: vuosittainen investointipolku',
      appendixInvestmentPlanByClass: 'Liite C: investointisuunnitelma luokittain',
      appendixDepreciationPlan: 'Liite D: poistosuunnitelma',
      appendixYearlyInvestmentRows: 'Liite E: vuosittaiset investointirivit',
      appendixAssumptions: 'Liite F: oletukset',
      table: {
        year: 'Vuosi',
        water: 'Vesi',
        wastewater: 'Jatevesi',
        combined: 'Yhdistetty',
        investments: 'Investoinnit',
        result: 'Tulos',
        cashflow: 'Kassavirta',
        cumulativeCash: 'Kum. kassa',
        depreciation: 'Poistot',
        annualTotal: 'Vuosiyhteensa',
        fiveYearBands: 'Viiden vuoden jaksot',
        code: 'Koodi',
        project: 'Projekti',
        account: 'Tili',
        total: 'Yhteensa',
        class: 'Luokka',
        split: 'Jako',
        method: 'Menetelma',
        writeOff: 'Poistoaika',
        residual: 'Jaannos',
        amount: 'Maara',
        group: 'Ryhma',
        type: 'Tyyppi',
        confidence: 'Varmuus',
        note: 'Huomio',
      },
      noSavedInvestments: 'Ei tallennettuja investointeja.',
      noSavedAssumptions: 'Ei tallennettuja oletuksia.',
      nearTermExpenseOverrides: 'Lahivuosien kustannusoletukset',
      thereafterExpenseProfile: 'Myohainen kustannusprofiili',
      personnel: 'henkilosto',
      energy: 'energia',
      otherOpex: 'muu kaytto',
      savedTariffAssumption: 'Tallennettu maksuoletus',
    };
  }
  if (locale === 'sv') {
    return {
      ...en,
      created: 'Skapad',
      scenarioBranches: {
        base: 'Bas',
        committed: 'Beslutad',
        hypothesis: 'Hypotes',
        stress: 'Stress',
      },
      scenarioBranch: 'Scenariotyp',
      planRevision: 'Planrevision',
      baselineYear: 'Basår',
      acceptedBaselineYears: 'Godkända basår',
      forecastHorizon: 'Prognoshorisont',
      financials: 'Ekonomi',
      prices: 'Priser',
      soldVolumes: 'Sålda volymer',
      keyFigures: 'Nyckeltal',
      requiredCombinedPriceToday: 'Nödvändigt kombinerat pris idag',
      requiredIncreaseFromCurrentCombinedPrice:
        'Nödvändig höjning från nuvarande kombinerade pris',
      totalInvestments: 'Investeringar totalt',
      tariffJustification: 'Avgiftsmotivering',
      currentBaselineCombinedPrice: 'Nuvarande kombinerat baspris',
      requiredIncreaseFromCurrentPrice: 'Nödvändig höjning från nuvarande pris',
      baselineSoldVolume: 'Såld basvolym',
      totalDepreciation: 'Avskrivningar totalt',
      peakAnnualInvestment: 'Högsta årliga investering',
      expenseOverrides: 'Kostnadsantaganden',
      nearTerm: 'närtid',
      none: 'inga',
      thereafter: 'Därefter',
      configured: 'konfigurerad',
      selectedInvestmentsRequire: (price: string) =>
        `Valda investeringar kräver ett kombinerat pris på ${price} idag.`,
      acceptedTariffPackage: (revenue: string, years: string | number) =>
        `Godkänt avgiftspaket: ${revenue} årlig intäkt efter ${years} år.`,
      averageAnnualCustomerImpact: 'Genomsnittlig årlig kundpåverkan',
      smoothingStatus15: '15 %-status',
      feeLabels: {
        connectionFee: 'Anslutningsavgift',
        baseFee: 'Grundavgift',
        waterUsageFee: 'Vattenpris',
        wastewaterUsageFee: 'Avloppspris',
      },
      impact: 'effekt',
      internalEvidenceAppendix: 'Intern evidensbilaga',
      evidenceLabels: {
        assetInventory: 'Egendomsunderlag',
        conditionStudies: 'Konditionsstudier',
        maintenance: 'Underhåll',
        municipalContext: 'Kommunal kontext',
        financialRisk: 'Finansiell risk',
        publicationBoundary: 'Publiceringsgräns',
        communication: 'Kommunikation',
        tariffRevenue: 'Avgiftsintäkter',
        tariffCosts: 'Avgiftskostnader',
        regionalDifferentiation: 'Regional differentiering',
        stormwater: 'Dagvatten',
        specialUse: 'Särskild användning',
        connectionFeeLiability: 'Anslutningsavgiftsskuld',
        ownerDistribution: 'Ägarfördelning',
      },
      riskSummary: 'Risksammanfattning',
      annualResultToZero: 'Årsresultat till noll',
      cumulativeCashFloor: 'Kumulativ kassagräns',
      annualUnderfundingStarts: 'Årsunderskott börjar',
      cashUnderfundingStarts: 'Kassaunderskott börjar',
      peakGap: 'Största gap',
      largestAnnualDeficit: 'Största årsunderskott',
      acceptedBaselineProvenance: 'Godkänd basårsproveniens',
      year: 'År',
      estimate: 'uppskattning',
      evidence: 'Evidens',
      veetiDatasets: 'VEETI-källor',
      manualDatasets: 'Manuella källor',
      appendixAnnualTariffPath: 'Bilaga A: årlig avgiftsbana',
      appendixAnnualInvestmentPath: 'Bilaga B: årlig investeringsbana',
      appendixInvestmentPlanByClass: 'Bilaga C: investeringsplan per klass',
      appendixDepreciationPlan: 'Bilaga D: avskrivningsplan',
      appendixYearlyInvestmentRows: 'Bilaga E: årliga investeringsrader',
      appendixAssumptions: 'Bilaga F: antaganden',
      table: {
        year: 'År',
        water: 'Vatten',
        wastewater: 'Avlopp',
        combined: 'Kombinerat',
        investments: 'Investeringar',
        result: 'Resultat',
        cashflow: 'Kassaflöde',
        cumulativeCash: 'Kum. kassa',
        depreciation: 'Avskr.',
        annualTotal: 'Årstotal',
        fiveYearBands: 'Femårsblock',
        code: 'Kod',
        project: 'Projekt',
        account: 'Konto',
        total: 'Totalt',
        class: 'Klass',
        split: 'Fördelning',
        method: 'Metod',
        writeOff: 'Avskrivningstid',
        residual: 'Restvärde',
        amount: 'Belopp',
        group: 'Grupp',
        type: 'Typ',
        confidence: 'Säkerhet',
        note: 'Anteckning',
      },
      noSavedInvestments: 'Inga sparade investeringar.',
      noSavedAssumptions: 'Inga sparade antaganden.',
      nearTermExpenseOverrides: 'Kostnadsantaganden för närtid',
      thereafterExpenseProfile: 'Kostnadsprofil därefter',
      personnel: 'personal',
      energy: 'energi',
      otherOpex: 'övrig drift',
      savedTariffAssumption: 'Sparat avgiftsantagande',
    };
  }
  return en;
}

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
  const pdfReportLocale = normalizePdfReportLocale(
    snapshot?.reportLocale,
    report.title,
  );
  const PDF_LOCALE = PDF_DATE_LOCALES[pdfReportLocale];
  const pdfLabels = PDF_LABELS[pdfReportLocale];
  const pdfCopy = createPdfCopy(pdfReportLocale);
  const yearsUnit =
    pdfReportLocale === 'en' ? 'years' : pdfReportLocale === 'fi' ? 'vuotta' : 'år';

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
    formatConfidence,
    formatDatasetEvidenceDetail,
    formatDatasetSource,
    formatDatasetTypeList,
    formatDepreciationMethod,
    formatInvestmentType,
    formatMoney,
    formatPct,
    formatPrice,
    formatServiceSplit,
    formatSourceStatus,
    formatVesinvestKeyLabel,
    formatVolume,
  } = createPdfReportSupport({
    toPdfText,
    normalizeText,
    toNumber,
    pdfLocale: PDF_LOCALE,
  });

  const variantLabel = pdfLabels.variants[reportVariant];
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
      ? `${pdfCopy.appendixAnnualTariffPath} ${annualTariffRows[0]!.year}-${
          annualTariffRows[annualTariffRows.length - 1]!.year
        } (${annualTariffRows.length} ${yearsUnit})`
      : pdfCopy.appendixAnnualTariffPath;
  const scenarioHorizonLabel =
    annualTariffRows.length > 0
      ? `${annualTariffRows[0]!.year}-${
          annualTariffRows[annualTariffRows.length - 1]!.year
        } (${annualTariffRows.length} ${yearsUnit})`
      : '-';
  const acceptedBaselineYearsLabel = formatAcceptedBaselineYears(snapshot);
  const scenarioBranchLabel =
    scenario?.scenarioType === 'base'
      ? pdfCopy.scenarioBranches.base
      : scenario?.scenarioType === 'committed'
      ? pdfCopy.scenarioBranches.committed
      : scenario?.scenarioType === 'hypothesis'
      ? pdfCopy.scenarioBranches.hypothesis
      : scenario?.scenarioType === 'stress'
      ? pdfCopy.scenarioBranches.stress
      : '-';
  const annualInvestmentHeading =
    annualInvestmentRows.length > 0
      ? `${pdfCopy.appendixAnnualInvestmentPath} ${annualInvestmentRows[0]!.year}-${
          annualInvestmentRows[annualInvestmentRows.length - 1]!.year
        } (${annualInvestmentRows.length} ${yearsUnit})`
      : pdfCopy.appendixAnnualInvestmentPath;
  const investmentPlanHeading = pdfCopy.appendixInvestmentPlanByClass;
  const depreciationPlanHeading = pdfCopy.appendixDepreciationPlan;
  const yearlyInvestmentsHeading = pdfCopy.appendixYearlyInvestmentRows;
  const assumptionsHeading = pdfCopy.appendixAssumptions;
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
  const tariffFeeLabels: Record<string, string> = pdfCopy.feeLabels;
  const formatTariffUnit = (key: string, value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) {
      return '-';
    }
    return key === 'waterUsageFee' || key === 'wastewaterUsageFee'
      ? formatPrice(value)
      : formatMoney(value);
  };
  const evidenceNote = (value: unknown) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { notes?: unknown }).notes === 'string'
      ? ((value as { notes: string }).notes.trim() || null)
      : null;

  const drawTariffTableHeader = () => {
    draw(pdfCopy.table.year, 30, y, 8, true);
    draw(pdfCopy.table.water, 75, y, 8, true);
    draw(pdfCopy.table.wastewater, 135, y, 8, true);
    draw(pdfCopy.table.combined, 205, y, 8, true);
    draw(pdfCopy.table.investments, 280, y, 8, true);
    draw(pdfCopy.table.result, 380, y, 8, true);
    draw(pdfCopy.table.cashflow, 470, y, 8, true);
    draw(pdfCopy.table.cumulativeCash, 565, y, 8, true);
    draw(pdfCopy.table.depreciation, 675, y, 8, true);
    y -= 12;
  };
  const drawAnnualInvestmentTableHeader = () => {
    draw(pdfCopy.table.year, 40, y, 9, true);
    draw(pdfCopy.table.annualTotal, 130, y, 9, true);
    y -= 12;
  };

  draw(report.title, MARGIN_LEFT, y, 16, true);
  y -= 24;
  drawLine(`${pdfLabels.reportVariant}: ${variantLabel}`);
  drawLine(`${pdfCopy.created}: ${new Date(report.createdAt).toLocaleString(PDF_LOCALE)}`);
  drawLine(`${pdfCopy.scenario}: ${normalizeText(report.ennuste?.nimi) ?? '-'}`);
  drawLine(`${pdfCopy.scenarioBranch}: ${scenarioBranchLabel}`);
  if (snapshot?.vesinvestPlan?.name) {
    drawLine(
      `${pdfCopy.planRevision}: ${snapshot.vesinvestPlan.name} / v${
        snapshot.vesinvestPlan.versionNumber ?? '-'
      }`,
    );
  }
  drawLine(`${pdfCopy.baselineYear}: ${report.baselineYear}`);
  drawLine(`${pdfCopy.acceptedBaselineYears}: ${acceptedBaselineYearsLabel}`);
  drawLine(`${pdfCopy.forecastHorizon}: ${scenarioHorizonLabel}`);
  if (reportSections.baselineSources && primaryBaselineSourceSummary) {
    drawLine(
      `${pdfCopy.financials}: ${formatDatasetSource(primaryBaselineSourceSummary.financials, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.prices}: ${formatDatasetSource(primaryBaselineSourceSummary.prices, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.soldVolumes}: ${formatDatasetSource(primaryBaselineSourceSummary.volumes, '-')}`,
      MARGIN_LEFT,
      10,
      false,
      18,
    );
  } else {
    y -= 8;
  }
  y -= 8;

  drawSectionHeading(pdfCopy.keyFigures);
  drawLine(
    `${pdfCopy.requiredCombinedPriceToday}: ${formatPrice(report.requiredPriceToday)}`,
    MARGIN_LEFT,
    11,
    true,
  );
  drawLine(
    `${pdfCopy.requiredIncreaseFromCurrentCombinedPrice}: ${formatPct(
      report.requiredAnnualIncreasePct,
    )}`,
    MARGIN_LEFT,
    11,
    true,
  );
  drawLine(
    `${pdfCopy.totalInvestments}: ${formatMoney(report.totalInvestments)}`,
    MARGIN_LEFT,
    11,
    true,
    24,
  );

  drawSectionHeading(pdfCopy.tariffJustification);
  drawLine(
    `${pdfCopy.currentBaselineCombinedPrice}: ${
      baselineCombinedPrice != null ? formatPrice(baselineCombinedPrice) : '-'
    }`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  drawLine(
    `${pdfCopy.requiredCombinedPriceToday}: ${formatPrice(report.requiredPriceToday)}`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  drawLine(
    `${pdfCopy.requiredIncreaseFromCurrentPrice}: ${formatPct(
      report.requiredAnnualIncreasePct,
    )}`,
    MARGIN_LEFT,
    10,
    false,
    14,
  );
  if (baselineTariffRow) {
    drawLine(
      `${pdfCopy.baselineSoldVolume} (${baselineTariffRow.year}): ${formatVolume(
        baselineTariffRow.soldVolume,
      )} | ${pdfCopy.totalDepreciation} (${baselineTariffRow.year}): ${formatMoney(
        baselineTariffRow.totalDepreciation,
      )}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
  }
  if (peakAnnualInvestmentRow) {
    drawLine(
      `${pdfCopy.peakAnnualInvestment}: ${peakAnnualInvestmentRow.year} -> ${formatMoney(
        peakAnnualInvestmentRow.totalAmount,
      )}`,
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
        : pdfCopy.none;
    const thereafterLabel = thereafterExpenseProfile
      ? reportSections.assumptions
        ? `${pdfCopy.personnel} ${formatPct(thereafterExpenseProfile.personnelPct)}, ${pdfCopy.energy} ${formatPct(thereafterExpenseProfile.energyPct)}, ${pdfCopy.otherOpex} ${formatPct(thereafterExpenseProfile.opexOtherPct)}`
        : pdfCopy.configured
      : '-';
    drawLine(
      `${pdfCopy.expenseOverrides}: ${pdfCopy.nearTerm} ${nearTermYearsLabel} | ${pdfCopy.thereafter} ${thereafterLabel}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
  }
  if (reportSections.assumptions && savedTariffAssumptionRows.length > 0) {
    for (const [key, value] of savedTariffAssumptionRows) {
      drawLine(
        `${pdfCopy.savedTariffAssumption} - ${assumptionLabels[key] ?? key}: ${formatAssumptionValue(key, toNumber(value))}`,
        MARGIN_LEFT,
        10,
        false,
        14,
      );
    }
  }
  drawLine(
    pdfCopy.selectedInvestmentsRequire(formatPrice(report.requiredPriceToday)),
    MARGIN_LEFT,
    10,
    false,
    26,
  );
  if (acceptedTariffPlan?.recommendation) {
    drawLine(
      pdfCopy.acceptedTariffPackage(
        formatMoney(acceptedTariffPlan.recommendation.proposedAnnualRevenue ?? 0),
        acceptedTariffPlan.recommendation.smoothingYears ?? '-',
      ),
      MARGIN_LEFT,
      10,
      true,
      14,
    );
    drawLine(
      `${pdfCopy.averageAnnualCustomerImpact}: ${formatPct(
        acceptedTariffPlan.recommendation.averageAnnualIncreasePct ?? null,
      )} | ${pdfCopy.smoothingStatus15}: ${
        acceptedTariffPlan.recommendation.lawReadiness?.smoothingStatus ?? '-'
      }`,
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
        )} -> ${formatTariffUnit(key, fee.proposedUnit)} | ${
          pdfCopy.impact
        } ${formatMoney(fee.revenueImpact ?? 0)}`,
        MARGIN_LEFT,
        10,
        false,
        14,
      );
    }
    if (reportSections.assumptions) {
      const evidenceRows = [
        [pdfCopy.evidenceLabels.assetInventory, snapshot?.vesinvestPlan?.assetEvidenceState],
        [pdfCopy.evidenceLabels.conditionStudies, snapshot?.vesinvestPlan?.conditionStudyState],
        [pdfCopy.evidenceLabels.maintenance, snapshot?.vesinvestPlan?.maintenanceEvidenceState],
        [pdfCopy.evidenceLabels.municipalContext, snapshot?.vesinvestPlan?.municipalPlanContext],
        [pdfCopy.evidenceLabels.financialRisk, snapshot?.vesinvestPlan?.financialRiskState],
        [pdfCopy.evidenceLabels.publicationBoundary, snapshot?.vesinvestPlan?.publicationState],
        [pdfCopy.evidenceLabels.communication, snapshot?.vesinvestPlan?.communicationState],
        [pdfCopy.evidenceLabels.tariffRevenue, acceptedTariffPlan.revenueEvidence],
        [pdfCopy.evidenceLabels.tariffCosts, acceptedTariffPlan.costEvidence],
        [pdfCopy.evidenceLabels.regionalDifferentiation, acceptedTariffPlan.regionalDifferentiationState],
        [pdfCopy.evidenceLabels.stormwater, acceptedTariffPlan.stormwaterState],
        [pdfCopy.evidenceLabels.specialUse, acceptedTariffPlan.specialUseState],
        [pdfCopy.evidenceLabels.connectionFeeLiability, acceptedTariffPlan.connectionFeeLiabilityState],
        [pdfCopy.evidenceLabels.ownerDistribution, acceptedTariffPlan.ownerDistributionState],
      ] as const;
      const evidenceNotes = evidenceRows
        .map(([label, value]) => [label, evidenceNote(value)] as const)
        .filter(([, note]) => note);
      if (evidenceNotes.length > 0) {
        drawSectionHeading(pdfCopy.internalEvidenceAppendix);
        for (const [label, note] of evidenceNotes) {
          drawLine(`${label}: ${note}`, MARGIN_LEFT, 10, false, 14);
        }
      }
    }
  }

  if (reportSections.riskSummary) {
    drawSectionHeading(pdfCopy.riskSummary);
    drawLine(
      `${pdfCopy.annualResultToZero}: ${formatPrice(annualResultPrice)} (${formatPct(
        annualResultIncrease,
      )})`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.cumulativeCashFloor}: ${formatPrice(cumulativeCashPrice)} (${formatPct(
        cumulativeCashIncrease,
      )})`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.annualUnderfundingStarts}: ${annualUnderfundingYear ?? '-'}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.cashUnderfundingStarts}: ${cumulativeUnderfundingYear ?? '-'} | ${
        pdfCopy.peakGap
      }: ${formatMoney(peakCumulativeGap)}`,
      MARGIN_LEFT,
      10,
      false,
      14,
    );
    drawLine(
      `${pdfCopy.largestAnnualDeficit}: ${formatMoney(peakAnnualDeficit)}`,
      MARGIN_LEFT,
      10,
      false,
      22,
    );
  }

  if (reportSections.baselineSources && baselineSourceSummaries.length > 0) {
    drawSectionHeading(pdfCopy.acceptedBaselineProvenance);
    for (const summary of baselineSourceSummaries) {
      drawLine(
        `${pdfCopy.year} ${summary.year ?? '-'}: ${formatSourceStatus(
          summary.sourceStatus,
        )}${
          summary.planningRole === 'current_year_estimate'
            ? ` (${pdfCopy.estimate})`
            : ''
        }`,
        MARGIN_LEFT,
        10,
        true,
        14,
      );
      drawLine(
        `${pdfCopy.financials}: ${formatDatasetSource(summary.financials, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const financialEvidence = formatDatasetEvidenceDetail(summary.financials);
      if (financialEvidence) {
        drawLine(
          `${pdfCopy.evidence}: ${financialEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `${pdfCopy.prices}: ${formatDatasetSource(summary.prices, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const priceEvidence = formatDatasetEvidenceDetail(summary.prices);
      if (priceEvidence) {
        drawLine(
          `${pdfCopy.evidence}: ${priceEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `${pdfCopy.soldVolumes}: ${formatDatasetSource(summary.volumes, '-')}`,
        MARGIN_LEFT + 10,
        10,
        false,
        12,
      );
      const volumeEvidence = formatDatasetEvidenceDetail(summary.volumes);
      if (volumeEvidence) {
        drawLine(
          `${pdfCopy.evidence}: ${volumeEvidence}`,
          MARGIN_LEFT + 20,
          8,
          false,
          12,
        );
      }
      drawLine(
        `${pdfCopy.veetiDatasets}: ${formatDatasetTypeList(
          summary.sourceBreakdown?.veetiDataTypes,
        )}`,
        MARGIN_LEFT + 10,
        9,
        false,
        12,
      );
      drawLine(
        `${pdfCopy.manualDatasets}: ${formatDatasetTypeList(
          summary.sourceBreakdown?.manualDataTypes,
        )}`,
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
      drawLine(pdfCopy.table.fiveYearBands, MARGIN_LEFT, 10, true, 14);
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
        draw(pdfCopy.table.code, 40, y, 9, true);
        draw(pdfCopy.table.project, 110, y, 9, true);
        draw(pdfCopy.table.account, 420, y, 9, true);
        draw(pdfCopy.table.total, 510, y, 9, true);
        y -= 12;

        for (const group of vesinvestAppendix?.groupedProjects ?? []) {
          ensureSpace(18);
          draw(
            toPdfText(formatVesinvestKeyLabel(group.classKey, group.classLabel)),
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
            draw(
              toPdfText(
                formatVesinvestKeyLabel(project.accountKey, null).slice(0, 22),
              ),
              420,
              y,
              8,
            );
            draw(formatMoney(project.totalAmount), 510, y, 8);
            y -= 11;
            for (const line of allocationLines) {
              draw(toPdfText(line.slice(0, 86)), 110, y, 7);
              y -= 9;
            }
          }
        }
      } else {
        draw(pdfCopy.table.class, 40, y, 9, true);
        draw(pdfCopy.table.total, 510, y, 9, true);
        y -= 12;

        for (const group of vesinvestAppendix?.groupedProjects ?? []) {
          ensureSpace(14);
          draw(
            toPdfText(formatVesinvestKeyLabel(group.classKey, group.classLabel)),
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
      draw(pdfCopy.table.class, 40, y, 9, true);
      draw(pdfCopy.table.account, 240, y, 9, true);
      draw(pdfCopy.table.split, 350, y, 9, true);
      draw(pdfCopy.table.method, 430, y, 9, true);
      draw(pdfCopy.table.writeOff, 600, y, 9, true);
      draw(pdfCopy.table.residual, 690, y, 9, true);
      y -= 12;

      for (const row of vesinvestAppendix?.depreciationPlan ?? []) {
        ensureSpace(14);
        draw(
          toPdfText(
            formatVesinvestKeyLabel(row.classKey, row.classLabel).slice(0, 28),
          ),
          40,
          y,
          8,
        );
        draw(
          toPdfText(formatVesinvestKeyLabel(row.accountKey, null).slice(0, 24)),
          240,
          y,
          8,
        );
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
    draw(pdfCopy.table.year, 30, y, 9, true);
    draw(pdfCopy.table.amount, 90, y, 9, true);
    draw(pdfCopy.table.group, 180, y, 9, true);
    draw(pdfCopy.table.type, 320, y, 9, true);
    draw(pdfCopy.table.confidence, 430, y, 9, true);
    draw(pdfCopy.table.note, 540, y, 9, true);
    y -= 12;

    const investmentRows = scenario?.yearlyInvestments ?? [];
    if (investmentRows.length === 0) {
      drawLine(pdfCopy.noSavedInvestments, MARGIN_LEFT, 10);
    } else {
      for (const row of investmentRows) {
        ensureSpace(14);
        draw(String(row.year), 30, y, 8);
        draw(formatMoney(row.amount), 90, y, 8);
        draw(
          toPdfText(formatVesinvestKeyLabel(row.category, row.category).slice(0, 28)),
          180,
          y,
          8,
        );
        draw(toPdfText(formatInvestmentType(row.investmentType).slice(0, 18)), 320, y, 8);
        draw(toPdfText(formatConfidence(row.confidence).slice(0, 14)), 430, y, 8);
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
      drawLine(pdfCopy.noSavedAssumptions, MARGIN_LEFT, 10);
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
        drawLine(pdfCopy.nearTermExpenseOverrides, MARGIN_LEFT, 10, true, 14);
        for (const row of nearTermExpenseRows) {
          drawLine(
            `${row.year}: ${pdfCopy.personnel} ${formatPct(row.personnelPct)}, ${
              pdfCopy.energy
            } ${formatPct(row.energyPct)}, ${pdfCopy.otherOpex} ${formatPct(
              row.opexOtherPct,
            )}`,
            MARGIN_LEFT + 10,
            10,
            false,
            14,
          );
        }
      }
      if (thereafterExpenseProfile) {
        drawLine(pdfCopy.thereafterExpenseProfile, MARGIN_LEFT, 10, true, 14);
        drawLine(
          `${pdfCopy.personnel} ${formatPct(
            thereafterExpenseProfile.personnelPct,
          )} | ${pdfCopy.energy} ${formatPct(
            thereafterExpenseProfile.energyPct,
          )} | ${pdfCopy.otherOpex} ${formatPct(
            thereafterExpenseProfile.opexOtherPct,
          )}`,
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
