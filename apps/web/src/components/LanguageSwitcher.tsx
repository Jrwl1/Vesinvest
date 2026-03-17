import React from 'react';
import { useTranslation } from 'react-i18next';
import { applyManualLanguagePreference } from '../i18n';

const normalizeLanguage = (value: string | undefined): 'fi' | 'sv' | 'en' => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  const base = normalized.split('-')[0];
  if (base === 'fi' || base === 'sv' || base === 'en') return base;
  return 'fi';
};

const LANGUAGES = [
  { code: 'fi', label: 'FI' },
  { code: 'sv', label: 'SV' },
  { code: 'en', label: 'EN' },
] as const;

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const activeLanguage = normalizeLanguage(
    i18n.resolvedLanguage ?? i18n.language,
  );

  return (
    <div className="language-switcher">
      {LANGUAGES.map((lang) => (
        <button
          type="button"
          key={lang.code}
          className={`lang-btn ${
            activeLanguage === lang.code ? 'lang-btn-active' : ''
          }`}
          onClick={() => {
            void applyManualLanguagePreference(lang.code);
          }}
          title={lang.label}
          aria-label={lang.label}
          aria-pressed={activeLanguage === lang.code}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};
