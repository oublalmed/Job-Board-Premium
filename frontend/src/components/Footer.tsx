'use client';

import Link from 'next/link';
import { useLocale } from '@/i18n/locale-context';

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
            JB
          </div>
          <span className="text-sm font-medium text-foreground">
            {t('app.name')}
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            {t('footer.privacy')}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            {t('footer.terms')}
          </Link>
          <Link href="/contact" className="transition-colors hover:text-foreground">
            {t('footer.contact')}
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Talentiq. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
