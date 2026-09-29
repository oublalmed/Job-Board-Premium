'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  GraduationCap,
  CalendarClock,
  Pencil,
  Send,
  XCircle,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateCasablanca } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { JobForm } from '@/features/jobs/JobForm';
import {
  useRecruiterJob,
  useUpdateJob,
  usePublishJob,
  useCloseJob,
  useOfferApplications,
  useUpdateApplicationStatus,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type RecruiterApplication,
} from '@/features/jobs/queries';
import {
  JOB_STATUS_BADGE,
  APPLICATION_STATUS_BADGE,
  contractTypeKey,
  experienceLevelKey,
} from '@/features/jobs/labels';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function RecruiterJobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { t, locale } = useLocale();
  const { toast } = useToast();

  const { data: offer, isLoading, isError, refetch } = useRecruiterJob(id);
  const updateJob = useUpdateJob(id);
  const publishJob = usePublishJob(id);
  const closeJob = useCloseJob(id);
  const [editing, setEditing] = useState(false);

  function handleEdit(values: Parameters<typeof updateJob.mutate>[0]) {
    updateJob.mutate(values, {
      onSuccess: () => {
        toast(t('jobs.recruiter.updated'), 'success');
        setEditing(false);
      },
      onError: (err) =>
        toast(err instanceof ApiError ? err.message : t('common.error'), 'error'),
    });
  }

  function handlePublish() {
    publishJob.mutate(undefined, {
      onSuccess: () => toast(t('jobs.recruiter.published'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleClose() {
    closeJob.mutate(undefined, {
      onSuccess: () => toast(t('jobs.recruiter.closed'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <Link
        href="/jobs"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('jobs.recruiter.backToList')}
      </Link>

      {isLoading && <Skeleton className="h-40" />}

      {isError && !isLoading && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t('jobs.recruiter.notFound')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {offer && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-bold text-foreground">
                    {offer.title}
                  </h1>
                  <Badge
                    variant={JOB_STATUS_BADGE[offer.status].variant}
                    className="w-fit"
                  >
                    {t(JOB_STATUS_BADGE[offer.status].key)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3.5" />
                    {t('jobs.recruiter.edit')}
                  </Button>
                  {offer.status !== 'published' && offer.status !== 'closed' && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handlePublish}
                      disabled={publishJob.isPending}
                    >
                      {publishJob.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      {t('jobs.recruiter.publish')}
                    </Button>
                  )}
                  {offer.status === 'published' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleClose}
                      disabled={closeJob.isPending}
                    >
                      {closeJob.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <XCircle className="size-3.5" />
                      )}
                      {t('jobs.recruiter.close')}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {offer.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {offer.location}
                  </span>
                )}
                {offer.contractType && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="size-3.5" />
                    {t(contractTypeKey(offer.contractType))}
                  </span>
                )}
                {offer.experienceLevel && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="size-3.5" />
                    {t(experienceLevelKey(offer.experienceLevel))}
                  </span>
                )}
                {offer.deadline && (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {t('jobs.detail.deadline', {
                      date: formatDateCasablanca(new Date(offer.deadline), locale),
                    })}
                  </span>
                )}
              </div>

              {offer.skills && offer.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {offer.skills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              {offer.description && (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {offer.description}
                </p>
              )}
            </CardContent>
          </Card>

          <ApplicationsSection offerId={id} />

          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('jobs.recruiter.editTitle')}</DialogTitle>
              </DialogHeader>
              <JobForm
                initial={offer}
                submitLabel={t('common.save')}
                submitting={updateJob.isPending}
                onSubmit={handleEdit}
                onCancel={() => setEditing(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </motion.div>
  );
}

function ApplicationsSection({ offerId }: { offerId: string }) {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = useOfferApplications(offerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-5 text-primary" />
          {t('jobs.recruiter.applicationsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}
        {isError && !isLoading && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="size-5 text-destructive" />
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('jobs.recruiter.noApplications')}
          </p>
        )}
        {!isLoading &&
          !isError &&
          data?.map((app) => (
            <ApplicationRow key={app.id} offerId={offerId} app={app} />
          ))}
      </CardContent>
    </Card>
  );
}

function ApplicationRow({
  offerId,
  app,
}: {
  offerId: string;
  app: RecruiterApplication;
}) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const updateStatus = useUpdateApplicationStatus(offerId);
  const name =
    [app.candidate.firstName, app.candidate.lastName]
      .filter(Boolean)
      .join(' ') || t('jobs.recruiter.anonymousCandidate');
  const badge = APPLICATION_STATUS_BADGE[app.status];

  function handleStatusChange(status: ApplicationStatus) {
    updateStatus.mutate(
      { applicationId: app.id, status },
      {
        onSuccess: () => toast(t('jobs.recruiter.statusUpdated'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{name}</span>
          {app.candidate.headline && (
            <span className="text-xs text-muted-foreground">
              {app.candidate.headline}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {t('jobs.detail.appliedOn', {
              date: formatDateCasablanca(new Date(app.createdAt), locale),
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{t(badge.key)}</Badge>
        </div>
      </div>

      {app.coverLetter && (
        <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">
          {app.coverLetter}
        </p>
      )}

      <div className="flex items-center gap-2">
        <label
          htmlFor={`status-${app.id}`}
          className="text-xs text-muted-foreground"
        >
          {t('jobs.recruiter.changeStatus')}
        </label>
        <Select
          id={`status-${app.id}`}
          className="h-9 w-auto"
          value={app.status}
          disabled={updateStatus.isPending}
          onChange={(e) =>
            handleStatusChange(e.target.value as ApplicationStatus)
          }
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(APPLICATION_STATUS_BADGE[s].key)}
            </option>
          ))}
        </Select>
        {updateStatus.isPending && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
