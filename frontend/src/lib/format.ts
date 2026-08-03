const CASABLANCA_TIME_ZONE = 'Africa/Casablanca';

export type SupportedLocale = 'fr' | 'ar';

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
