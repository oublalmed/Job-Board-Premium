'use client';

import { useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  Loader2,
  XCircle,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminSubscriptions,
  useCancelSubscription,
  useSuspendSubscription,
  useReactivateSubscription,
  type SubscriptionStatus,
} from '@/features/admin/subscriptions';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const FILTERS: Array<SubscriptionStatus | 'all'> = [
  'all',
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'expired',
];

// Statuses shown as overview tiles (mirrors the backend SubscriptionStatus enum).
const OVERVIEW_STATUSES = [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'expired',
] as const;

const STATUS_VARIANT: Record<
  SubscriptionStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  trial: 'default',
  active: 'success',
  past_due: 'warning',
  suspended: 'warning',
  cancelled: 'destructive',
  expired: 'destructive',
};

// Admin management of recruiter subscriptions.
export default function AdminSubscriptionsPage() {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const [filter, setFilter] = useState<SubscriptionStatus | 'all'>('all');
  const { data, isLoading, isError, refetch } = useAdminSubscriptions(filter);
  const cancel = useCancelSubscription();
  const suspend = useSuspendSubscription();
  const reactivate = useReactivateSubscription();
  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  function onCancel(id: string) {
    if (!window.confirm(t('adminSubscriptions.cancelConfirm'))) return;
    cancel.mutate(id, {
      onSuccess: () => toast(t('adminSubscriptions.cancelled'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function onSuspend(id: string) {
    if (!window.confirm(t('adminSubscriptions.suspendConfirm'))) return;
    suspend.mutate(id, {
      onSuccess: () => toast(t('adminSubscriptions.suspended'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function onReactivate(id: string) {
    reactivate.mutate(id, {
      onSuccess: () => toast(t('adminSubscriptions.reactivated'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale) : '—';

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <CreditCard className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminSubscriptions.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('adminSubscriptions.subtitle')}
          </p>
        </div>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {OVERVIEW_STATUSES.map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-foreground">
                {counts[s] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`adminSubscriptions.status_${s}`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-0.5"
        role="tablist"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              filter === f
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all'
              ? t('adminSubscriptions.filter_all')
              : t(`adminSubscriptions.status_${f}`)}
          </button>
        ))}
      </div>

      {isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('adminSubscriptions.empty')}
              </p>
            ) : (
              <ul className="flex flex-col">
                {items.map((s) => {
                  const cancelPending =
                    cancel.isPending && cancel.variables === s.id;
                  const suspendPending =
                    suspend.isPending && suspend.variables === s.id;
                  const reactivatePending =
                    reactivate.isPending && reactivate.variables === s.id;
                  const busy =
                    cancelPending || suspendPending || reactivatePending;
                  const terminal =
                    s.status === 'cancelled' || s.status === 'expired';
                  const isSuspended = s.status === 'suspended';
                  // Suspending only makes sense for a live subscription that
                  // isn't already on hold.
                  const canSuspend = !terminal && !isSuspended;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {s.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('adminSubscriptions.contactsUsage', {
                            used: String(s.contactsUsed),
                            quota: String(s.contactQuota),
                          })}
                          {' · '}
                          {t('adminSubscriptions.period', {
                            start: fmtDate(s.startsAt),
                            end: fmtDate(s.endsAt),
                          })}
                          {s.cancelAtPeriodEnd
                            ? ` · ${t('adminSubscriptions.cancelScheduled')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="default">
                          {t(`adminSubscriptions.plan_${s.plan}`)}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[s.status]}>
                          {t(`adminSubscriptions.status_${s.status}`)}
                        </Badge>
                        {isSuspended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => onReactivate(s.id)}
                          >
                            {reactivatePending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <PlayCircle className="size-3.5" />
                            )}
                            {t('adminSubscriptions.reactivate')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={busy || !canSuspend}
                            onClick={() => onSuspend(s.id)}
                          >
                            {suspendPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <PauseCircle className="size-3.5" />
                            )}
                            {t('adminSubscriptions.suspend')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          disabled={busy || terminal}
                          onClick={() => onCancel(s.id)}
                        >
                          {cancelPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                          {t('adminSubscriptions.cancel')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
