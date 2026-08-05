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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFunnel, type FunnelStepType } from '@/features/analytics/queries';

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
