'use client';

import { useState } from 'react';
import { Flag, AlertCircle, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import {
  useMessageReports,
  useUpdateReportStatus,
  type ReportStatus,
} from '@/features/admin/moderation';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const TABS: ReportStatus[] = ['open', 'reviewed', 'dismissed'];

// EF-ADM-01 / EF-MSG-05 (frontend) — the message-abuse moderation queue.
export default function AdminMessageReportsPage() {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const [tab, setTab] = useState<ReportStatus>('open');
  const { data, isLoading, isError, refetch } = useMessageReports(tab);
  const update = useUpdateReportStatus();

  const reports = data ?? [];

  function resolve(id: string, status: ReportStatus) {
    update.mutate(
      { id, status },
      {
        onSuccess: () => toast(t('moderation.updated'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Flag className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('moderation.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('moderation.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 self-start rounded-lg border border-border p-0.5">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => setTab(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === s
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`moderation.status.${s}`)}
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
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t('moderation.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{r.reason}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {t('moderation.conversation')}: {r.conversationId.slice(0, 8)} ·{' '}
                    {formatDateCasablanca(new Date(r.createdAt), locale)}
                  </p>
                </div>
                {tab === 'open' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={update.isPending}
                      onClick={() => resolve(r.id, 'reviewed')}
                    >
                      <Check className="size-4" />
                      {t('moderation.markReviewed')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      disabled={update.isPending}
                      onClick={() => resolve(r.id, 'dismissed')}
                    >
                      <X className="size-4" />
                      {t('moderation.dismiss')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
