'use client';

import { useState } from 'react';
import {
  BarChart3,
  UserPlus,
  MailCheck,
  Play,
  Award,
  MessageSquare,
  CreditCard,
  AlertCircle,
  Users,
  Building2,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFunnel,
  useAdminOverview,
  type FunnelStepType,
  type PlanKey,
} from '@/features/analytics/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const STEP_ICON: Record<FunnelStepType, React.ComponentType<{ className?: string }>> = {
  signup: UserPlus,
  email_verified: MailCheck,
  test_started: Play,
  score_obtained: Award,
  recruiter_contact: MessageSquare,
  subscription_created: CreditCard,
};

const RANGES: { label: string; days?: number }[] = [
  { label: 'd7', days: 7 },
  { label: 'd30', days: 30 },
  { label: 'all', days: undefined },
];

const PLAN_LABEL: Record<PlanKey, string> = {
  starter: 'Starter',
  growth: 'Pro',
  scale: 'Premium',
  enterprise: 'Enterprise',
};

export default function AdminAnalyticsPage() {
  const { t } = useLocale();
  const [range, setRange] = useState<number | undefined>(30);
  const { data, isLoading, isError, refetch } = useFunnel(range);

  const steps = data?.steps ?? [];
  const top = steps[0]?.count ?? 0;

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('analytics.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              aria-pressed={range === r.days}
              onClick={() => setRange(r.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === r.days
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`analytics.range.${r.label}`)}
            </button>
          ))}
        </div>
      </div>

      {/* §5 — real platform KPIs, above the acquisition funnel. */}
      <PlatformOverview />

      {isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            {isLoading ? (
              <>
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </>
            ) : top === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('analytics.empty')}
              </div>
            ) : (
              steps.map((step) => {
                const Icon = STEP_ICON[step.type];
                const pct = top > 0 ? Math.round((step.count / top) * 100) : 0;
                return (
                  <div key={step.type} className="flex items-center gap-4">
                    <div className="flex w-44 shrink-0 items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {t(`analytics.steps.${step.type}`)}
                      </span>
                    </div>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted/50">
                      <div
                        className="flex h-full items-center rounded-lg bg-gradient-to-r from-primary to-primary/70 px-3 transition-all duration-700"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      >
                        <span className="text-xs font-semibold text-primary-foreground">
                          {step.count}
                        </span>
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-end text-xs text-muted-foreground">
                      {pct}% {t('analytics.ofTop')}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// §5 — platform KPI cards (users, companies, subscriptions, jobs, apps, evals),
// all from real counts. Rendered above the funnel; loads independently so a
// funnel error never hides the overview.
function PlatformOverview() {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = useAdminOverview();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertCircle className="size-5 text-destructive" />
          <p className="text-sm text-muted-foreground">{t('common.error')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const plans = Object.entries(data.subscriptions.byPlan) as [
    PlanKey,
    number,
  ][];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          icon={Users}
          label={t('adminAnalytics.users')}
          value={data.users.total}
          hint={t('adminAnalytics.usersBreakdown', {
            candidates: String(data.users.candidates),
            recruiters: String(data.users.recruiters),
          })}
        />
        <OverviewCard
          icon={Building2}
          label={t('adminAnalytics.companies')}
          value={data.companies.total}
          hint={t('adminAnalytics.activeSubscriptions', {
            count: String(data.subscriptions.active),
          })}
        />
        <OverviewCard
          icon={Briefcase}
          label={t('adminAnalytics.jobs')}
          value={data.jobs.total}
          hint={t('adminAnalytics.publishedJobs', {
            count: String(data.jobs.published),
          })}
        />
        <OverviewCard
          icon={ClipboardCheck}
          label={t('adminAnalytics.assessments')}
          value={data.assessments.total}
          hint={t('adminAnalytics.completedAssessments', {
            count: String(data.assessments.completed),
          })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('adminAnalytics.subscriptionsByPlan')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {plans.map(([plan, count]) => (
            <div
              key={plan}
              className="flex min-w-24 flex-col rounded-lg border border-border/60 px-4 py-3"
            >
              <span className="text-xs text-muted-foreground">
                {PLAN_LABEL[plan]}
              </span>
              <span className="text-xl font-bold tabular-nums text-foreground">
                {count}
              </span>
            </div>
          ))}
          <div className="flex min-w-24 flex-col rounded-lg border border-border/60 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {t('adminAnalytics.applications')}
            </span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {data.applications.total}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}
