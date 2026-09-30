'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Plus,
  Users,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeatureGate } from '@/features/entitlements/FeatureGate';
import { JobForm } from '@/features/jobs/JobForm';
import {
  useRecruiterJobs,
  useCreateJob,
  type JobOfferWithCount,
} from '@/features/jobs/queries';
import { JOB_STATUS_BADGE } from '@/features/jobs/labels';
import { ApiError } from '@/lib/api';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function RecruiterJobsPage() {
  const { t } = useLocale();

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Briefcase className="size-6 text-primary" />
            {t('jobs.recruiter.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('jobs.recruiter.subtitle')}
          </p>
        </div>
      </div>

      {/* UI gate mirrors the backend FeatureGuard (JOBS). Starter packs see the
          upsell; the API returns 403 regardless (§22 rule #4). */}
      <FeatureGate feature="jobs">
        <JobsManager />
      </FeatureGate>
    </motion.div>
  );
}

function JobsManager() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useRecruiterJobs();
  const createJob = useCreateJob();
  const [open, setOpen] = useState(false);

  function handleCreate(values: Parameters<typeof createJob.mutate>[0]) {
    createJob.mutate(values, {
      onSuccess: () => {
        toast(t('jobs.recruiter.created'), 'success');
        setOpen(false);
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError ? err.message : t('common.error');
        toast(msg, 'error');
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t('jobs.recruiter.create')}
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {isError && !isLoading && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Briefcase className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('jobs.recruiter.emptyTitle')}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t('jobs.recruiter.emptyBody')}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((offer) => (
            <JobCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('jobs.recruiter.create')}</DialogTitle>
          </DialogHeader>
          <JobForm
            submitLabel={t('jobs.recruiter.create')}
            submitting={createJob.isPending}
            onSubmit={handleCreate}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobCard({ offer }: { offer: JobOfferWithCount }) {
  const { t } = useLocale();
  const badge = JOB_STATUS_BADGE[offer.status];
  return (
    <Link href={`/jobs/${offer.id}`} className="group">
      <Card className="h-full transition-all duration-200 hover:shadow-md group-hover:border-primary/40">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary">
              {offer.title}
            </h3>
            <Badge variant={badge.variant}>{t(badge.key)}</Badge>
          </div>
          {offer.location && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {offer.location}
            </span>
          )}
          <div className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-3.5" />
            {t('jobs.recruiter.applicationsCount', {
              count: String(offer.applicationsCount),
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
