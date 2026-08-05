'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
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

// The active locale as a tiny module-level external store, read via
// useSyncExternalStore. This is what lets the server snapshot ('fr') and
// the client's detected locale differ WITHOUT a hydration mismatch and
// WITHOUT a setState-in-an-effect (the previous mount-effect + useState
// pattern tripped react-hooks/set-state-in-effect). There is only ever one
// LocaleProvider, so a module-scoped value is safe.
let currentLocale: SupportedLocale | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): SupportedLocale {
  currentLocale ??= detectLocale();
  return currentLocale;
}

function getServerSnapshot(): SupportedLocale {
  return 'fr';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setStoredLocale(next: SupportedLocale) {
  currentLocale = next;
  for (const listener of listeners) listener();
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sync external systems (the <html lang> attribute + the persisted
  // choice) whenever the locale changes. No setState here, so no cascading
  // render — this is the intended use of an effect.
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setStoredLocale(newLocale);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(locale, key, vars),
    [locale],
  );

  const ta = useCallback((key: string) => tArray(locale, key), [locale]);

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
