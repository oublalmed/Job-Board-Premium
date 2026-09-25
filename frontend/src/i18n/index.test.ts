import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, isRtlLocale, t, textDirection } from './index';
import fr from './locales/fr/common.json';
import ar from './locales/ar/common.json';

// ENF-14 — Arabic locale + RTL. These lock in the contract the layout and the
// locale context depend on: the locale is registered, its direction is RTL,
// and its bundle actually resolves (no silent key-path fallbacks).

describe('i18n locales (ENF-14)', () => {
  it('registers Arabic as a supported locale', () => {
    expect(SUPPORTED_LOCALES).toContain('ar');
  });

  it('marks Arabic as right-to-left and Latin locales as left-to-right', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('fr')).toBe('ltr');
    expect(textDirection('en')).toBe('ltr');
  });

  it('resolves Arabic strings (not key-path fallbacks)', () => {
    const value = t('ar', 'nav.home');
    expect(value).not.toBe('nav.home');
    expect(value).toBe(ar.nav.home);
  });

  it('interpolates variables in the Arabic bundle', () => {
    expect(t('ar', 'search.results', { count: '7' })).toContain('7');
    expect(t('ar', 'dashboard.roles', { roles: 'admin' })).toContain('admin');
  });

  it('keeps the Arabic bundle at full key parity with French', () => {
    const leafKeys = (obj: unknown, prefix = ''): string[] => {
      if (Array.isArray(obj)) return [prefix];
      if (obj && typeof obj === 'object') {
        return Object.entries(obj).flatMap(([k, v]) =>
          leafKeys(v, prefix ? `${prefix}.${k}` : k),
        );
      }
      return [prefix];
    };
    expect(new Set(leafKeys(ar))).toEqual(new Set(leafKeys(fr)));
  });
});
