'use client';

import { useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  Loader2,
  XCircle,
  PauseCircle,
  PlayCircle,
  PackagePlus,
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
  useAssignableCompanies,
  useAssignPlan,
  type SubscriptionStatus,
  type SubscriptionPlan,
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

const PLANS: SubscriptionPlan[] = ['starter', 'growth', 'scale', 'enterprise'];

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

      <AssignPackCard />

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

// Admin assigns (or changes) a company's pack per its contract. Recruiters no
// longer self-serve — this is the single place a plan is provisioned.
function AssignPackCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data: companies, isLoading } = useAssignableCompanies();
  const assign = useAssignPlan();

  const [companyId, setCompanyId] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlan>('starter');
  const [quota, setQuota] = useState('');

  const isEnterprise = plan === 'enterprise';
  const quotaRequired = isEnterprise; // Enterprise quota is per-contract.
  const canSubmit =
    !!companyId && (!quotaRequired || quota.trim() !== '') && !assign.isPending;

  const fieldClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      toast(t('adminSubscriptions.assignSelectCompany'), 'error');
      return;
    }
    let contactQuota: number | undefined;
    if (quota.trim() !== '') {
      const n = Number(quota);
      if (!Number.isFinite(n) || n < 0) {
        toast(t('common.error'), 'error');
        return;
      }
      contactQuota = Math.floor(n);
    } else if (quotaRequired) {
      toast(t('adminSubscriptions.assignQuotaRequired'), 'error');
      return;
    }
    assign.mutate(
      { companyId, plan, contactQuota },
      {
        onSuccess: () => {
          toast(t('adminSubscriptions.assignDone'), 'success');
          setCompanyId('');
          setQuota('');
        },
        onError: () => toast(t('adminSubscriptions.assignError'), 'error'),
      },
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <PackagePlus className="size-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t('adminSubscriptions.assignTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('adminSubscriptions.assignSubtitle')}
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('adminSubscriptions.assignCompany')}
            </span>
            <select
              className={fieldClass}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">
                {isLoading
                  ? t('common.loading')
                  : t('adminSubscriptions.assignCompanyPlaceholder')}
              </option>
              {(companies ?? []).map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                  {c.currentPlan
                    ? ` — ${t(`adminSubscriptions.plan_${c.currentPlan}`)}`
                    : ` — ${t('adminSubscriptions.assignNoPlan')}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('adminSubscriptions.assignPlan')}
            </span>
            <select
              className={fieldClass}
              value={plan}
              onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {t(`adminSubscriptions.plan_${p}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('adminSubscriptions.assignQuota')}
              {quotaRequired ? ' *' : ''}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={fieldClass}
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              placeholder={
                quotaRequired
                  ? t('adminSubscriptions.assignQuotaRequiredPlaceholder')
                  : t('adminSubscriptions.assignQuotaDefault')
              }
            />
          </label>

          <div className="lg:col-span-4">
            <Button type="submit" className="gap-2" disabled={!canSubmit}>
              {assign.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PackagePlus className="size-4" />
              )}
              {t('adminSubscriptions.assignButton')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
