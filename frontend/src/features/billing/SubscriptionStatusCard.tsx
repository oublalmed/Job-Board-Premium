'use client';

import { CreditCard, AlertTriangle, CalendarClock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactQuota } from './queries';

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  trial: 'secondary',
  past_due: 'destructive',
  cancelled: 'secondary',
};

// EF-BILL-02 / EF-BILL-05 — the recruiter's current subscription state: plan,
// lifecycle status, renewal/expiry date, a scheduled-cancellation note, the
// remaining contact allowance, and — when the payment is past due — a dunning
// alert prompting them to fix billing before access lapses.
export function SubscriptionStatusCard() {
  const { t, locale } = useLocale();
  const { data, isLoading } = useContactQuota();

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : '—';

  if (!data || !data.active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" />
            {t('subscription.statusTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('subscription.noActivePlan')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = data.status ?? 'active';
  const isPastDue = data.pastDueSince !== null || status === 'past_due';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          {t('subscription.statusTitle')}
        </CardTitle>
        <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>
          {t(`subscription.status_${status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPastDue && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {t('subscription.dunningTitle')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('subscription.dunningBody')}
                {data.pastDueSince ? ` (${fmtDate(data.pastDueSince)})` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('subscription.plan')}</p>
            <p className="text-sm font-medium capitalize text-foreground">
              {data.plan ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {data.cancelAtPeriodEnd
                ? t('subscription.endsOn')
                : t('subscription.renewsOn')}
            </p>
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {fmtDate(data.endsAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t('subscription.contactsRemaining')}
            </p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {data.contactsRemaining ?? '—'}
              {data.contactQuota !== null ? ` / ${data.contactQuota}` : ''}
            </p>
          </div>
        </div>

        {data.cancelAtPeriodEnd && (
          <p className="text-xs text-muted-foreground">
            {t('subscription.cancelScheduled')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
