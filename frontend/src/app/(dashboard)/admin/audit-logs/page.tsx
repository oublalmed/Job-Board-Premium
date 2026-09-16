'use client';

import { useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import { useAuditLogs } from '@/features/admin/moderation';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

// EF-ADM-04 (frontend) — consulter les journaux d'audit.
export default function AdminAuditLogsPage() {
  const { t, locale } = useLocale();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAuditLogs(page);

  const items = data?.items ?? [];
  const pageCount = data?.pageCount ?? 1;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <ScrollText className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('auditLog.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('auditLog.subtitle')}</p>
        </div>
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
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {t('auditLog.empty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('auditLog.title')}</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        {t('auditLog.colDate')}
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        {t('auditLog.colAction')}
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        {t('auditLog.colActor')}
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        {t('auditLog.colEntity')}
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        {t('auditLog.colIp')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {formatDateCasablanca(new Date(log.createdAt), locale)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {log.actorId ?? t('auditLog.system')}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {log.entityType
                            ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {log.ipAddress ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
