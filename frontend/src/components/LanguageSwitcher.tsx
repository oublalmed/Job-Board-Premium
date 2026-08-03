'use client';

import { useLocale } from '@/i18n/locale-context';
import { SUPPORTED_LOCALES } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5"
      role="group"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LOCALES.map((loc) => {
        const isActive = locale === loc;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLocale(loc)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`language.${loc}`)}
          </button>
        );
      })}
    </div>
  );
}
