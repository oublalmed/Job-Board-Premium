'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  usePendingVerifications,
  type PendingVerification,
} from '@/features/admin/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function AdminSchoolVerificationsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = usePendingVerifications();
  const items = data ?? [];

  const columns = useMemo<ColumnDef<PendingVerification>[]>(
    () => [
      {
        accessorKey: 'candidateName',
        header: t('nav.candidates'),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <GraduationCap className="size-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {item.candidateName ?? t('admin.schoolVerifications.unnamedCandidate')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'matchedSchool',
        header: t('admin.schoolVerifications.matchTitle'),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col items-start gap-1">
              {item.matchedSchool ? (
                <Badge variant="secondary">{item.matchedSchool}</Badge>
              ) : (
                <Badge variant="outline">{t('admin.schoolVerifications.noMatch')}</Badge>
              )}
              {item.confidence != null && (
                <span className="text-xs text-muted-foreground">
                  {t('admin.schoolVerifications.confidence', {
                    value: String(Math.round(Number(item.confidence))),
                  })}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: () => (
          <div className="flex justify-end">
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              {t('admin.schoolVerifications.review')}
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">
        {t('admin.schoolVerifications.title')}
      </h1>

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
        <DataTable
          columns={columns}
          data={items}
          loading={isLoading}
          onRowClick={(row) => router.push(`/admin/school-verifications/${row.id}`)}
          emptyState={
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-muted">
                <GraduationCap className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('admin.schoolVerifications.empty')}
              </p>
            </div>
          }
        />
      )}
    </motion.div>
  );
}
