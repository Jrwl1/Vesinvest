import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fi from './locales/fi.json';
import sv from './locales/sv.json';
import en from './locales/en.json';

const LANGUAGE_KEY = 'va_language';

function getSavedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_KEY) || 'fi';
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
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

// Persist language choice
i18n.on('languageChanged', (lng: string) => {
  try {
    localStorage.setItem(LANGUAGE_KEY, lng);
  } catch {
    // Ignore localStorage errors
  }
  document.documentElement.lang = lng;
});

// Set initial lang attribute
document.documentElement.lang = getSavedLanguage();

export default i18n;
export { LANGUAGE_KEY };
