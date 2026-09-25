'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  Play,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import {
  useDataRequests,
  useResolveDataRequest,
  type DataRequest,
  type DataRequestResolution,
} from '@/features/admin/data-requests';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const TABS = [
  'pending',
  'in_progress',
  'completed',
  'rejected',
  'all',
] as const;

function isOpen(status: DataRequest['status']): boolean {
  return status === 'pending' || status === 'in_progress';
}

function isOverdue(r: DataRequest): boolean {
  return isOpen(r.status) && new Date(r.dueAt).getTime() < Date.now();
}

function DataRequestCard({
  request,
  onResolve,
  pending,
}: {
  request: DataRequest;
  onResolve: (
    id: string,
    status: DataRequestResolution,
    isErasure: boolean,
    note: string,
  ) => void;
  pending: boolean;
}) {
  const { t, locale } = useLocale();
  const [note, setNote] = useState('');
  const overdue = isOverdue(request);
  const erasure = request.type === 'erasure';

  return (
    <Card className={overdue ? 'border-destructive/40' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {t(`dataRequests.type.${request.type}`)}
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t(`dataRequests.status.${request.status}`)}
          </span>
          {erasure && isOpen(request.status) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3" />
              {t('dataRequests.destructive')}
            </span>
          )}
        </div>

        {request.message && (
          <p className="text-sm text-foreground">{request.message}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>
            {t('dataRequests.subject')}: {request.userId.slice(0, 8)}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-destructive' : ''}`}
          >
            <Clock className="size-3" />
            {t('dataRequests.due')}:{' '}
            {formatDateCasablanca(new Date(request.dueAt), locale)}
            {overdue ? ` · ${t('dataRequests.overdue')}` : ''}
          </span>
          {request.resolutionNote && (
            <span>
              {t('dataRequests.note')}: {request.resolutionNote}
            </span>
          )}
        </div>

        {isOpen(request.status) && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('dataRequests.notePlaceholder')}
              aria-label={t('dataRequests.notePlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex flex-wrap gap-2">
              {request.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={() =>
                    onResolve(request.id, 'in_progress', false, note)
                  }
                >
                  <Play className="size-4" />
                  {t('dataRequests.start')}
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                disabled={pending}
                onClick={() =>
                  onResolve(request.id, 'completed', erasure, note)
                }
              >
                <Check className="size-4" />
                {t('dataRequests.complete')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                disabled={pending}
                onClick={() => onResolve(request.id, 'rejected', false, note)}
              >
                <X className="size-4" />
                {t('dataRequests.reject')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// EF-ADM-03 (frontend) — the CNDP/RGPD data-subject request processing queue.
export default function AdminDataRequestsPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useDataRequests(tab, page);
  const resolve = useResolveDataRequest();

  const requests = data?.items ?? [];
  const pageCount = data?.pageCount ?? 1;

  function handleResolve(
    id: string,
    status: DataRequestResolution,
    isErasure: boolean,
    note: string,
  ) {
    // Completing an erasure runs the real anonymization server-side — confirm.
    if (
      status === 'completed' &&
      isErasure &&
      !window.confirm(t('dataRequests.confirmErasure'))
    ) {
      return;
    }
    resolve.mutate(
      { id, status, resolutionNote: note.trim() || undefined },
      {
        onSuccess: () => toast(t('dataRequests.updated'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  function selectTab(next: (typeof TABS)[number]) {
    setTab(next);
    setPage(1);
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('dataRequests.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('dataRequests.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 self-start rounded-lg border border-border p-0.5">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => selectTab(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === s
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`dataRequests.tab.${s}`)}
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
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t('dataRequests.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <DataRequestCard
              key={r.id}
              request={r}
              onResolve={handleResolve}
              pending={resolve.isPending}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
