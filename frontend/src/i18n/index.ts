import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar/common.json';
import fr from './locales/fr/common.json';

export const SUPPORTED_LOCALES = ['fr', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(['ar']);

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.has(locale as SupportedLocale);
}

// RTL is a layout direction, not a translation — this is the one place
// that derives <html dir> from the active locale and keeps it in sync.
// Runs on init (first paint) and on every language change (the switcher),
// never left to individual components to remember to do.
function syncDocumentDirection(locale: string): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: fr },
      ar: { common: ar },
    },
    ns: ['common'],
    defaultNS: 'common',
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LOCALES,
    detection: {
      // Once a user picks a language (LanguageSwitcher), it sticks across
      // reloads — checked before falling back to the browser's own
      // language list.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes on render — a second layer here would
      // double-escape entities in translated strings.
      escapeValue: false,
    },
  });

syncDocumentDirection(i18n.resolvedLanguage ?? 'fr');
i18n.on('languageChanged', syncDocumentDirection);

export default i18n;
