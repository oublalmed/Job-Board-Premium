'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  AlertCircle,
  MonitorX,
  Users,
  Copy,
  Eye,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssessmentIntegrity } from '@/features/admin/integrity';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function AdminIntegrityPage() {
  const { t, locale } = useLocale();
  const [scope, setScope] = useState<'flagged' | 'all'>('flagged');
  const { data, isLoading, isError, refetch } = useAssessmentIntegrity(scope);
  const items = data?.items ?? [];
  const counts = data?.counts;

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString(locale) : '—';

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5">
          <ShieldAlert className="size-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminIntegrity.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('adminIntegrity.subtitle')}
          </p>
        </div>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          icon={ShieldAlert}
          value={counts?.total ?? 0}
          label={t('adminIntegrity.flagged')}
        />
        <Tile
          icon={MonitorX}
          value={counts?.proctoring ?? 0}
          label={t('adminIntegrity.proctoring')}
        />
        <Tile
          icon={Users}
          value={counts?.multiAccount ?? 0}
          label={t('adminIntegrity.multiAccount')}
        />
        <Tile
          icon={Copy}
          value={counts?.plagiarism ?? 0}
          label={t('adminIntegrity.plagiarism')}
        />
      </div>

      {/* Scope tabs */}
      <div
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-0.5"
        role="tablist"
      >
        {(['flagged', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              scope === s
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'flagged'
              ? t('adminIntegrity.filterFlagged')
              : t('adminIntegrity.filterAll')}
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
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Eye className="size-6 text-success" />
                <p className="text-sm text-muted-foreground">
                  {t('adminIntegrity.empty')}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {items.map((r) => {
                  const leaves = r.tabSwitchCount + r.windowBlurCount;
                  return (
                    <li
                      key={r.assessmentId}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.candidateEmail ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.specialtyName ?? '—'}
                          {r.score != null ? ` · ${Math.round(r.score)}/100` : ''}
                          {' · '}
                          {t('adminIntegrity.completedAt', {
                            date: fmt(r.completedAt ?? r.startedAt),
                          })}
                          {r.ipAddress ? ` · ${r.ipAddress}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.proctoringFlagged && (
                          <Badge variant="destructive" className="gap-1">
                            <MonitorX className="size-3" />
                            {t('adminIntegrity.tagProctoring')}
                          </Badge>
                        )}
                        {r.multiAccountFlagged && (
                          <Badge variant="warning" className="gap-1">
                            <Users className="size-3" />
                            {t('adminIntegrity.tagMultiAccount')}
                          </Badge>
                        )}
                        {r.plagiarismVerdict &&
                          r.plagiarismVerdict !== 'clean' && (
                            <Badge variant="destructive" className="gap-1">
                              <Copy className="size-3" />
                              {t(`adminIntegrity.verdict_${r.plagiarismVerdict}`)}
                            </Badge>
                          )}
                        <Badge variant="secondary" className="tabular-nums">
                          {t('adminIntegrity.leaves', { count: String(leaves) })}
                        </Badge>
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

function Tile({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-5 text-muted-foreground" />
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
