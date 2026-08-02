import type { SupportedLocale } from '@/i18n';

const CASABLANCA_TIME_ZONE = 'Africa/Casablanca';

// Morocco-specific Intl locale tags (not bare 'fr'/'ar') — these are what
// actually drive correct digit shapes, grouping, and currency symbol
// placement for MAD, not just translated UI text.
function toIntlLocale(locale: SupportedLocale): string {
  return locale === 'ar' ? 'ar-MA' : 'fr-MA';
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
