'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Briefcase,
  MessageSquare,
  Search,
  FileText,
  Heart,
  ArrowRight,
  BarChart3,
  Bell,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/schema';

type Notification = components['schemas']['Notification'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();

  const [completeness, setCompleteness] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const isCandidate = user?.roles.includes('candidate');
  const isRecruiter = user?.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const promises: Promise<unknown>[] = [
        apiClient.GET('/api/v1/notifications').then(({ data }) => {
          if (data) setNotifications(data);
        }),
      ];

      if (isCandidate) {
        promises.push(
          apiClient.GET('/api/v1/candidates/profile/completeness').then(({ data }) => {
            if (data) setCompleteness((data as { completeness: number }).completeness ?? 0);
          }),
        );
      }

      await Promise.allSettled(promises);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const unreadNotifications = notifications.filter((n) => !n.readAt);

  return (
    <div className="flex flex-col gap-8">
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
              />
            )}
            {isRecruiter && (
              <StatCard
                icon={FileText}
                label={t('nav.offers')}
                value="—"
              />
            )}
            <StatCard
              icon={Bell}
              label={t('nav.notifications')}
              value={String(unreadNotifications.length)}
            />
            <StatCard
              icon={MessageSquare}
              label={t('nav.messages')}
              value="—"
            />
            <StatCard
              icon={TrendingUp}
              label={t('nav.jobs')}
              value="—"
            />
          </>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction href="/profile" icon={User} label={t('dashboard.editProfile')} />
          {isRecruiter ? (
            <>
              <QuickAction href="/candidates" icon={Search} label={t('dashboard.searchCandidates')} />
              <QuickAction href="/offers" icon={FileText} label={t('dashboard.manageOffers')} />
              <QuickAction href="/shortlist" icon={Heart} label={t('nav.shortlist')} />
            </>
          ) : (
            <QuickAction href="/jobs" icon={Briefcase} label={t('dashboard.browseJobs')} />
          )}
          <QuickAction href="/messages" icon={MessageSquare} label={t('dashboard.viewMessages')} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 rounded-xl border border-border/50 p-3"
                >
                  <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <Bell className="size-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!n.readAt && (
                    <div className="mt-1 size-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
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
        className="h-auto w-full justify-between gap-3 px-4 py-4 text-start"
      >
        <span className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Button>
    </Link>
  );
}
