'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  User,
  Briefcase,
  MessageSquare,
  Search,
  Heart,
  ArrowRight,
  BarChart3,
  Bell,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/features/notifications/queries';
import { useCompleteness } from '@/features/profile/queries';

// Recharts is heavy and client-only — code-split it out of the initial
// dashboard bundle and skip SSR (it measures the DOM to size itself).
const ActivityChart = dynamic(
  () => import('@/features/dashboard/ActivityChart').then((m) => m.ActivityChart),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> },
);

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();

  const isCandidate = user?.roles.includes('candidate') ?? false;
  const isRecruiter =
    user?.roles.some((r) => ['recruiter', 'company_admin', 'admin'].includes(r)) ?? false;

  const notificationsQuery = useNotifications();
  const completenessQuery = useCompleteness(isCandidate);

  if (!user) return null;

  const notifications = notificationsQuery.data ?? [];
  const unreadNotifications = notifications.filter((n) => !n.readAt);
  const loading = notificationsQuery.isLoading;
  const completeness = completenessQuery.data ?? null;

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('dashboard.welcome')}, {user.email.split('@')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.roles', { roles: user.roles.join(', ') })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            {isCandidate && (
              <StatCard
                icon={BarChart3}
                label={t('dashboard.profileCompletion')}
                value={completeness != null ? `${Math.round(completeness)}%` : '—'}
                color="from-primary/20 to-primary/5"
              />
            )}
            <StatCard
              icon={Bell}
              label={t('nav.notifications')}
              value={String(unreadNotifications.length)}
              color="from-amber-500/20 to-amber-500/5"
            />
            <StatCard
              icon={MessageSquare}
              label={t('nav.messages')}
              value="—"
              color="from-emerald-500/20 to-emerald-500/5"
            />
            <StatCard
              icon={TrendingUp}
              label={t('nav.jobs')}
              value="—"
              color="from-blue-500/20 to-blue-500/5"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              {t('dashboard.recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : notifications.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
              </div>
            ) : (
              <ActivityChart
                notifications={notifications}
                label={t('nav.notifications')}
                locale={locale}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <QuickAction href="/profile" icon={User} label={t('dashboard.editProfile')} />
            {isRecruiter ? (
              <>
                <QuickAction href="/candidates" icon={Search} label={t('dashboard.searchCandidates')} />
                <QuickAction href="/shortlist" icon={Heart} label={t('nav.shortlist')} />
              </>
            ) : (
              <QuickAction href="/jobs" icon={Briefcase} label={t('dashboard.browseJobs')} />
            )}
            <QuickAction href="/messages" icon={MessageSquare} label={t('dashboard.viewMessages')} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('nav.notifications')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl border border-border/50 p-3 transition-all ${
                    !n.readAt ? 'border-primary/20 bg-primary/[0.02]' : ''
                  }`}
                >
                  <div className="relative mt-0.5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                      <Bell className="size-4 text-primary" />
                    </div>
                    {!n.readAt && (
                      <div className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>
            <Icon className="size-5 text-primary" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        className="h-auto w-full justify-between gap-3 px-4 py-3.5 text-start transition-all hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
            <Icon className="size-4 text-primary" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Button>
    </Link>
  );
}
