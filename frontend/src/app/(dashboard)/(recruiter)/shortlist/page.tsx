'use client';

import { Heart, Trash2, Calendar, StickyNote, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useRemoveShortlistEntry,
  useShortlist,
} from '@/features/shortlist/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function ShortlistPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useShortlist();
  const removeEntry = useRemoveShortlistEntry();
  const entries = data ?? [];

  const removingId = removeEntry.isPending ? removeEntry.variables : null;

  function handleRemove(id: string) {
    if (!confirm(t('shortlist.removeConfirm'))) return;
    removeEntry.mutate(id, {
      onSuccess: () => toast(t('shortlist.removed'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('shortlist.title')}</h1>
        {!isLoading && !isError && entries.length > 0 && (
          <Badge variant="secondary">{entries.length} candidates</Badge>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {isLoading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {isError && (
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
        )}

        {!isLoading &&
          !isError &&
          entries.map((entry) => (
            <Card key={entry.id} className="group transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <Heart className="size-5 text-primary" />
                  </div>
                  <div>
                    <Link
                      href={`/candidates/${entry.candidateProfile?.id ?? entry.id}`}
                      className="font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {entry.candidateProfile?.firstName} {entry.candidateProfile?.lastName}
                    </Link>
                    {entry.candidateProfile?.headline && (
                      <p className="text-sm text-muted-foreground">
                        {entry.candidateProfile.headline}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {t('shortlist.addedOn')}{' '}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                      {entry.note && (
                        <span className="flex items-center gap-1 italic">
                          <StickyNote className="size-3" />
                          {entry.note}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  className="text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removingId === entry.id}
                >
                  {removingId === entry.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}

        {!isLoading && !isError && entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Heart className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t('shortlist.empty')}</p>
            <Link href="/candidates" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                {t('dashboard.searchCandidates')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
