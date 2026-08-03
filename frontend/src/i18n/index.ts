import fr from './locales/fr/common.json';
import en from './locales/en/common.json';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type TranslationTree = typeof fr;

const translations: Record<SupportedLocale, TranslationTree> = { fr, en };

function getNestedValue(obj: unknown, path: string): string {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

export function t(
  locale: SupportedLocale,
  key: string,
  vars?: Record<string, string>,
): string {
  let value = getNestedValue(translations[locale], key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return value;
}

export function tArray(locale: SupportedLocale, key: string): string[] {
  let current: unknown = translations[locale];
  for (const k of key.split('.')) {
    if (current == null || typeof current !== 'object') return [];
    current = (current as Record<string, unknown>)[k];
  }
  return Array.isArray(current) ? (current as string[]) : [];
}
