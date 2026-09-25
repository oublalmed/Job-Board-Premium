'use client';

import Link from 'next/link';
import { AlertTriangle, Users } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { useContactQuota } from './queries';

// A contact allowance is "low" at 10% remaining, with a floor of 3, so small
// plans still warn before the very last contact.
function isLow(remaining: number, quota: number): boolean {
  return remaining > 0 && remaining <= Math.max(3, Math.ceil(quota * 0.1));
}

/**
 * EF-BILL-04 + EF-RECR-05 — mounted across every recruiter page.
 *
 * When the subscription is inactive it explains *why* access is restricted
 * (the backend's subscription guard otherwise blocks silently) and links to
 * billing. When active, it surfaces the remaining contact quota before the
 * limit is hit. Fails silent while loading / on error so it never blocks the
 * page it wraps.
 */
export function RecruiterAccessBar() {
  const { t } = useLocale();
  const { data, isLoading, isError } = useContactQuota();

  if (isLoading || isError || !data) return null;

  if (!data.active) {
    return (
      <div
        role="alert"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {t('billing.restrictedTitle')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('billing.restrictedDescription')}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 self-start sm:self-center">
          <Link href="/subscription">{t('billing.restrictedCta')}</Link>
        </Button>
      </div>
    );
  }

  const remaining = data.contactsRemaining ?? 0;
  const quota = data.contactQuota ?? 0;
  const exhausted = remaining === 0;
  const low = isLow(remaining, quota);

  const tone = exhausted
    ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : low
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
      : 'border-border bg-muted/40 text-foreground';

  return (
    <div
      className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${tone}`}
    >
      <span className="flex items-center gap-2 font-medium">
        <Users className="size-4" />
        <span className="tabular-nums">
          {remaining}
          <span className="text-muted-foreground">
            {' '}
            {t('billing.contactsOf')} {quota}
          </span>{' '}
          {t('billing.contactsRemaining')}
        </span>
      </span>
      {exhausted ? (
        <span className="text-xs font-semibold">
          {t('billing.quotaExhausted')}
        </span>
      ) : low ? (
        <span className="text-xs font-semibold">{t('billing.quotaLow')}</span>
      ) : null}
    </div>
  );
}
