'use client';

import { Briefcase, Building2, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishedJobs } from '@/features/jobs/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function JobsPage() {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = usePublishedJobs();
  const offers = data ?? [];

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('jobs.title')}</h1>
        {!isLoading && !isError && offers.length > 0 && (
          <Badge variant="secondary">{offers.length} offers</Badge>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {isLoading && (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
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
          offers.map((offer) => (
            <Card key={offer.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-start gap-5 p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Briefcase className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{offer.title}</h3>
                    <Badge variant="success">{t(`offers.status.${offer.status}`)}</Badge>
                  </div>
                  {offer.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {offer.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {offer.company?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {offer.company.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {t('jobs.postedOn')} {new Date(offer.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {!isLoading && !isError && offers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Briefcase className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">{t('jobs.empty')}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
