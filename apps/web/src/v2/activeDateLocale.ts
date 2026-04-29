export const getActiveDateLocale = (): string | undefined => {
  const documentLanguage =
    typeof document !== 'undefined' ? document.documentElement.lang : '';
  let savedLanguage = '';
  if (typeof localStorage !== 'undefined') {
    try {
      savedLanguage = localStorage.getItem('va_language') ?? '';
    } catch {
      savedLanguage = '';
    }
  }
  const language = (documentLanguage || savedLanguage)
    .trim()
    .toLowerCase()
    .split('-')[0];
  if (language === 'sv') return 'sv-FI';
  if (language === 'fi') return 'fi-FI';
  if (language === 'en') return 'en-US';
  return undefined;
};
