import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'fi', label: 'FI' },
  { code: 'sv', label: 'SV' },
  { code: 'en', label: 'EN' },
] as const;

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={`lang-btn ${i18n.language === lang.code ? 'lang-btn-active' : ''}`}
          onClick={() => i18n.changeLanguage(lang.code)}
          title={lang.code === 'fi' ? 'Suomi' : lang.code === 'sv' ? 'Svenska' : 'English'}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};
