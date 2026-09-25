import type { SupportedLocale } from '@/i18n';

const CASABLANCA_TIME_ZONE = 'Africa/Casablanca';

// Re-exported for callers that only need the type from here. The single source
// of truth is the i18n module (SUPPORTED_LOCALES) so adding a locale there
// (e.g. ENF-14 Arabic) flows through here with no duplicated union to update.
export type { SupportedLocale };

// Maps an app locale to a BCP-47 tag for Intl. Morocco-centric: French and
// Arabic both resolve to their Moroccan variants (fr-MA / ar-MA) so currency
// and date formatting follow local conventions; English falls back to en-GB.
const INTL_LOCALE_BY_LOCALE: Record<SupportedLocale, string> = {
  fr: 'fr-MA',
  en: 'en-GB',
  ar: 'ar-MA',
};

function toIntlLocale(locale: SupportedLocale): string {
  return INTL_LOCALE_BY_LOCALE[locale] ?? 'fr-MA';
}

export function formatCurrencyMAD(
  amount: number,
  locale: SupportedLocale,
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'currency',
    currency: 'MAD',
  }).format(amount);
}

export function formatDateCasablanca(
  date: Date,
  locale: SupportedLocale,
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    timeZone: CASABLANCA_TIME_ZONE,
    dateStyle: 'long',
  }).format(date);
}
