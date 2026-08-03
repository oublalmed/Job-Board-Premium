'use client';

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
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();

  if (!user) return null;

  const isRecruiter = user.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('dashboard.welcome')}, {user.email.split('@')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.roles', { roles: user.roles.join(', ') })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label={t('dashboard.profileCompletion')}
          value="—"
          trend=""
        />
        <StatCard
          icon={MessageSquare}
          label={t('nav.messages')}
          value="0"
          trend=""
        />
        <StatCard
          icon={Briefcase}
          label={t('nav.jobs')}
          value="—"
          trend=""
        />
        <StatCard
          icon={TrendingUp}
          label={t('nav.notifications')}
          value="0"
          trend=""
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            href="/profile"
            icon={User}
            label={t('dashboard.editProfile')}
          />
          {isRecruiter ? (
            <>
              <QuickAction
                href="/candidates"
                icon={Search}
                label={t('dashboard.searchCandidates')}
              />
              <QuickAction
                href="/offers"
                icon={FileText}
                label={t('dashboard.manageOffers')}
              />
              <QuickAction
                href="/shortlist"
                icon={Heart}
                label={t('nav.shortlist')}
              />
            </>
          ) : (
            <QuickAction
              href="/jobs"
              icon={Briefcase}
              label={t('dashboard.browseJobs')}
            />
          )}
          <QuickAction
            href="/messages"
            icon={MessageSquare}
            label={t('dashboard.viewMessages')}
          />
        </div>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
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
  trend: string;
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
