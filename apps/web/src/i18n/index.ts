import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';

const LANGUAGE_KEY = 'va_language';
const LANGUAGE_SOURCE_KEY = 'va_language_source';
const SUPPORTED_LANGUAGES = new Set(['fi', 'sv', 'en']);
export type SupportedLanguage = 'fi' | 'sv' | 'en';
type LanguageSource = 'manual' | 'org_default' | 'default';

function normalizeLanguage(
  value: string | null | undefined,
): SupportedLanguage {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  const base = normalized.split('-')[0];
  if (SUPPORTED_LANGUAGES.has(base)) return base as SupportedLanguage;
  return 'fi';
}

function getSavedLanguage(): SupportedLanguage {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return 'fi';
  }
}

function getSavedLanguageSource(): LanguageSource {
  try {
    const savedSource = localStorage.getItem(LANGUAGE_SOURCE_KEY);
    if (savedSource === 'manual' || savedSource === 'org_default') {
      return savedSource;
    }
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage != null && normalizeLanguage(savedLanguage) !== 'fi') {
      return 'manual';
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'default';
}

function persistLanguageSource(source: LanguageSource): void {
  try {
    localStorage.setItem(LANGUAGE_SOURCE_KEY, source);
  } catch {
    // Ignore localStorage errors
  }
}

i18n.use(initReactI18next).init({
  resources: {
    fi: { translation: fi },
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'fi',
  supportedLngs: ['fi', 'sv', 'en'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

// Persist language choice
i18n.on('languageChanged', (lng: string) => {
  const normalized = normalizeLanguage(lng);
  try {
    localStorage.setItem(LANGUAGE_KEY, normalized);
  } catch {
    // Ignore localStorage errors
  }
  document.documentElement.lang = normalized;
});

// Set initial lang attribute
document.documentElement.lang = getSavedLanguage();

export default i18n;
export function hasManualLanguageOverride(): boolean {
  return getSavedLanguageSource() === 'manual';
}

export async function applyManualLanguagePreference(
  value: string | null | undefined,
): Promise<SupportedLanguage> {
  const normalized = normalizeLanguage(value);
  persistLanguageSource('manual');
  await i18n.changeLanguage(normalized);
  return normalized;
}

export function resetLanguagePreferenceToDefault(
  value: string | null | undefined = 'fi',
): SupportedLanguage {
  const normalized = normalizeLanguage(value);
  persistLanguageSource('default');
  try {
    localStorage.setItem(LANGUAGE_KEY, normalized);
  } catch {
    // Ignore localStorage errors
  }
  document.documentElement.lang = normalized;
  return normalized;
}

export async function applyOrganizationDefaultLanguage(
  value: string | null | undefined,
): Promise<SupportedLanguage | null> {
  const normalized = normalizeLanguage(value);
  if (hasManualLanguageOverride()) {
    return null;
  }
  persistLanguageSource('org_default');
  if (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) !== normalized) {
    await i18n.changeLanguage(normalized);
    return normalized;
  }
  try {
    localStorage.setItem(LANGUAGE_KEY, normalized);
  } catch {
    // Ignore localStorage errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
  return normalized;
}

export { LANGUAGE_KEY,LANGUAGE_SOURCE_KEY,normalizeLanguage };
