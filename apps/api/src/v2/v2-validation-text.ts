export type V2ValidationTextLocale = 'en' | 'fi' | 'sv';

const LIVE_AUDIT_EVIDENCE_NOTE = 'Reviewed during live deployment audit.';
const LIVE_AUDIT_PROJECT_NOTE =
  'Plausible 20-year investment programme for audit flow.';
const BAD_ENCODING_PROJECT_NOTE =
  'Investeringsprogrammet har granskats f?r den aktiva planen.';
const BAD_ENCODING_TARIFF_EVIDENCE_NOTE =
  'Underlaget har granskats f?r den aktiva avgiftsplanen.';
const BAD_ENCODING_PROJECT_SUBTYPE = 'N?tsanering';
const LIVE_AUDIT_RISK_NOTE =
  'Moderate risk; monitor affordability, liquidity, and staged implementation.';
const LIVE_AUDIT_PROJECT_NAME = 'Ledningsn\u00e4t saneering 2026-2030';

type ValidationTextReplacement = {
  rawValues: string[];
  localized: Record<V2ValidationTextLocale, string>;
};

const validationTextReplacements: ValidationTextReplacement[] = [
  {
    rawValues: [LIVE_AUDIT_PROJECT_NAME],
    localized: {
      en: 'Network rehabilitation 2026-2030',
      fi: 'Verkoston saneeraus 2026-2030',
      sv: 'Sanering av ledningsnät 2026-2030',
    },
  },
  {
    rawValues: [BAD_ENCODING_PROJECT_SUBTYPE],
    localized: {
      en: 'Network rehabilitation',
      fi: 'Verkostosaneeraus',
      sv: 'Nätsanering',
    },
  },
  {
    rawValues: [LIVE_AUDIT_PROJECT_NOTE, BAD_ENCODING_PROJECT_NOTE],
    localized: {
      en: 'Investment programme reviewed for the active plan.',
      fi: 'Investointiohjelma on tarkistettu aktiivista suunnitelmaa varten.',
      sv: 'Investeringsprogrammet har granskats för den aktiva planen.',
    },
  },
  {
    rawValues: [LIVE_AUDIT_EVIDENCE_NOTE, BAD_ENCODING_TARIFF_EVIDENCE_NOTE],
    localized: {
      en: 'Evidence reviewed for the active plan.',
      fi: 'Aineisto on tarkistettu aktiivista suunnitelmaa varten.',
      sv: 'Underlaget har granskats för den aktiva planen.',
    },
  },
  {
    rawValues: [LIVE_AUDIT_RISK_NOTE],
    localized: {
      en: 'Monitor affordability, liquidity, and staged implementation.',
      fi: 'Seuraa maksukykyä, likviditeettiä ja vaiheittaista toteutusta.',
      sv: 'Följ betalningsförmåga, likviditet och etappvis genomförande.',
    },
  },
];

const assetEvidenceTextReplacements: ValidationTextReplacement[] = [
  {
    rawValues: [
      LIVE_AUDIT_EVIDENCE_NOTE,
      LIVE_AUDIT_PROJECT_NOTE,
      BAD_ENCODING_PROJECT_NOTE,
      BAD_ENCODING_TARIFF_EVIDENCE_NOTE,
    ],
    localized: {
      en: 'Evidence reviewed for the active plan.',
      fi: 'Aineisto on tarkistettu aktiivista suunnitelmaa varten.',
      sv: 'Underlaget har granskats för den aktiva planen.',
    },
  },
];

const tariffEvidenceTextReplacements: ValidationTextReplacement[] = [
  {
    rawValues: [LIVE_AUDIT_EVIDENCE_NOTE, BAD_ENCODING_TARIFF_EVIDENCE_NOTE],
    localized: {
      en: 'Evidence reviewed for the active tariff plan.',
      fi: 'Aineisto on tarkistettu aktiivista maksusuunnitelmaa varten.',
      sv: 'Underlaget har granskats för den aktiva avgiftsplanen.',
    },
  },
];

function localizeFromReplacements(
  replacements: ValidationTextReplacement[],
  locale: V2ValidationTextLocale,
  value: string | null | undefined,
): string {
  const text = value?.trim() ?? '';
  if (!text) return value ?? '';
  const replacement = replacements.find((item) =>
    item.rawValues.includes(text),
  );
  return replacement?.localized[locale] ?? value ?? '';
}

export function localizeV2ValidationText(
  locale: V2ValidationTextLocale,
  value: string | null | undefined,
): string {
  return localizeFromReplacements(validationTextReplacements, locale, value);
}

export function localizeV2AssetEvidenceText(
  locale: V2ValidationTextLocale,
  value: string | null | undefined,
): string {
  return localizeFromReplacements(assetEvidenceTextReplacements, locale, value);
}

export function localizeV2TariffEvidenceText(
  locale: V2ValidationTextLocale,
  value: string | null | undefined,
): string {
  return localizeFromReplacements(tariffEvidenceTextReplacements, locale, value);
}

export function normalizeV2ValidationText(
  value: string | null | undefined,
): string {
  return localizeV2ValidationText('sv', value);
}
