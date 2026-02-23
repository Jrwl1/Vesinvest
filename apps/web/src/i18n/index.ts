import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fi from './locales/fi.json';
import sv from './locales/sv.json';
import en from './locales/en.json';

const LANGUAGE_KEY = 'va_language';
const SUPPORTED_LANGUAGES = new Set(['fi', 'sv', 'en']);

function normalizeLanguage(
  value: string | null | undefined,
): 'fi' | 'sv' | 'en' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  const base = normalized.split('-')[0];
  if (SUPPORTED_LANGUAGES.has(base)) return base as 'fi' | 'sv' | 'en';
  return 'fi';
}

function getSavedLanguage(): string {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return 'fi';
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
export { LANGUAGE_KEY };
