'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  SUPPORTED_LOCALES,
  t as translate,
  tArray,
  type SupportedLocale,
} from './index';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  ta: (key: string) => string[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LOCALE_STORAGE_KEY = 'talentiq_locale';

function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'fr';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }
  const browserLang = navigator.language.split('-')[0];
  if (browserLang && SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
    return browserLang as SupportedLocale;
  }
  return 'fr';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('fr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectLocale());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(locale, key, vars),
    [locale],
  );

  const ta = useCallback(
    (key: string) => tArray(locale, key),
    [locale],
  );

  return (
    <LocaleContext value={{ locale, setLocale, t, ta }}>
      {children}
    </LocaleContext>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale() must be used within <LocaleProvider>');
  return ctx;
}
