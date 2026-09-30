'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Briefcase,
  Users,
  Heart,
  MessageSquare,
  Mail,
  AlertCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { FeatureGate } from '@/features/entitlements/FeatureGate';
import {
  useRecruiterAnalytics,
  type ApplicationStatusKey,
  type RecruiterAnalytics,
} from '@/features/analytics/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const STATUS_ORDER: ApplicationStatusKey[] = [
  'applied',
  'under_review',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
];

const RANGES = [7, 30, 90] as const;

export default function RecruiterAnalyticsPage() {
  const { t } = useLocale();
  const [days, setDays] = useState<number>(30);

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('recruiterAnalytics.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('recruiterAnalytics.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === r
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('recruiterAnalytics.rangeDays', { days: String(r) })}
            </button>
          ))}
        </div>
      </div>

      <FeatureGate feature="basic_analytics">
        <AnalyticsBody days={days} />
      </FeatureGate>
    </motion.div>
  );
}

function AnalyticsBody({ days }: { days: number }) {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = useRecruiterAnalytics(days);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t('common.error')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <AnalyticsContent data={data} />;
}

function AnalyticsContent({ data }: { data: RecruiterAnalytics }) {
  const { t, locale } = useLocale();

  const statusData = STATUS_ORDER.map((key) => ({
    key,
    label: t(`jobs.appStatus.${key}`),
    count: data.applications.byStatus[key] ?? 0,
  }));

  const intl =
    locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const trendData = data.applicationsTrend.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString(intl, {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  const contactsLabel =
    data.contacts.quota === null
      ? t('recruiterAnalytics.unlimited')
      : `${data.contacts.used} / ${data.contacts.quota}`;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards — all real, company-scoped counts. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Briefcase}
          label={t('recruiterAnalytics.publishedJobs')}
          value={`${data.jobs.published}`}
          hint={t('recruiterAnalytics.totalJobs', {
            count: String(data.jobs.total),
          })}
        />
        <Kpi
          icon={Users}
          label={t('recruiterAnalytics.applications')}
          value={`${data.applications.total}`}
        />
        <Kpi
          icon={Heart}
          label={t('recruiterAnalytics.shortlist')}
          value={`${data.shortlist.total}`}
        />
        <Kpi
          icon={MessageSquare}
          label={t('recruiterAnalytics.conversations')}
          value={`${data.conversations.total}`}
        />
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('recruiterAnalytics.contactsUsed')}
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {contactsLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('recruiterAnalytics.byStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.applications.total === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer height={240}>
                <BarChart
                  data={statusData}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="count"
                    name={t('recruiterAnalytics.applications')}
                    radius={[6, 6, 0, 0]}
                    fill="var(--color-primary)"
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('recruiterAnalytics.trend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.applications.total === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer height={240}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--color-border)' }}
                    content={<ChartTooltipContent />}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name={t('recruiterAnalytics.applications')}
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#appsFill)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('recruiterAnalytics.topOffers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topOffers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('recruiterAnalytics.noOffers')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.topOffers.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {o.title}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {t('recruiterAnalytics.applicationsCount', {
                      count: String(o.applications),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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

function EmptyChart() {
  const { t } = useLocale();
  return (
    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
      {t('recruiterAnalytics.empty')}
    </div>
  );
}
