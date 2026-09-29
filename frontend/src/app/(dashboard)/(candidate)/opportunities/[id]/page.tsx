'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Building2,
  GraduationCap,
  CalendarClock,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  UserCog,
  ClipboardCheck,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDateCasablanca } from '@/lib/format';
import { ApiError } from '@/lib/api';
import {
  useJobDetail,
  useApplyToJob,
  useMyApplications,
  useApplyEligibility,
  type ApplyEligibility,
} from '@/features/jobs/queries';
import {
  APPLICATION_STATUS_BADGE,
  contractTypeKey,
  experienceLevelKey,
} from '@/features/jobs/labels';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { t, locale } = useLocale();
  const { toast } = useToast();

  const { data: offer, isLoading, isError, refetch } = useJobDetail(id);
  const myApps = useMyApplications();
  const eligibility = useApplyEligibility();
  const apply = useApplyToJob(id);
  const [coverLetter, setCoverLetter] = useState('');

  const existing = myApps.data?.find((a) => a.offer.id === id) ?? null;
  const elig = eligibility.data;

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    apply.mutate(coverLetter, {
      onSuccess: () => {
        toast(t('jobs.candidate.applySuccess'), 'success');
        setCoverLetter('');
        void myApps.refetch();
      },
      onError: (err) => {
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 409) {
          toast(t('jobs.candidate.alreadyApplied'), 'error');
          void myApps.refetch();
        } else if (status === 403) {
          // §3 — not eligible; refresh the requirements shown below the form.
          toast(t('jobs.candidate.notEligible'), 'error');
          void eligibility.refetch();
        } else if (status === 400) {
          toast(t('jobs.candidate.completeProfile'), 'error');
        } else {
          toast(t('common.error'), 'error');
        }
      },
    });
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <Link
        href="/opportunities"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('jobs.candidate.backToList')}
      </Link>

      {isLoading && <Skeleton className="h-48" />}

      {isError && !isLoading && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t('jobs.candidate.notFound')}
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
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-foreground">
                  {offer.title}
                </h1>
                {offer.company?.name && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="size-4" />
                    {offer.company.name}
                  </span>
                )}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('jobs.candidate.applyTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {existing ? (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-success" />
                    <span className="text-sm font-medium text-foreground">
                      {t('jobs.candidate.alreadyAppliedTitle')}
                    </span>
                  </div>
                  <Badge variant={APPLICATION_STATUS_BADGE[existing.status].variant}>
                    {t(APPLICATION_STATUS_BADGE[existing.status].key)}
                  </Badge>
                </div>
              ) : elig && !elig.eligible ? (
                <EligibilityRequirements eligibility={elig} />
              ) : (
                <form onSubmit={handleApply} className="flex flex-col gap-3">
                  <Textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder={t('jobs.candidate.coverLetterPlaceholder')}
                    rows={5}
                    maxLength={4000}
                  />
                  <Button
                    type="submit"
                    className="w-fit gap-2"
                    disabled={apply.isPending || eligibility.isLoading}
                  >
                    {apply.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {t('jobs.candidate.applyButton')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}

// §3 — shown in place of the apply form when the candidate isn't yet eligible:
// what's left to unlock applications (profile completeness, an assessment).
function EligibilityRequirements({
  eligibility,
}: {
  eligibility: ApplyEligibility;
}) {
  const { t } = useLocale();
  const needsProfile = eligibility.reasons.includes('PROFILE_INCOMPLETE');
  const needsExam = eligibility.reasons.includes('NO_COMPLETED_ASSESSMENT');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-5 text-warning" />
        <span className="text-sm font-medium text-foreground">
          {t('jobs.candidate.eligibilityTitle')}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {needsProfile && (
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <UserCog className="size-4 text-muted-foreground" />
              {t('jobs.candidate.needProfile', {
                completeness: String(Math.round(eligibility.completeness)),
                threshold: String(eligibility.threshold),
              })}
            </span>
            <Link
              href="/profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('jobs.candidate.completeProfileCta')}
            </Link>
          </li>
        )}
        {needsExam && (
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <ClipboardCheck className="size-4 text-muted-foreground" />
              {t('jobs.candidate.needExam')}
            </span>
            <Link
              href="/assessments"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('jobs.candidate.takeExamCta')}
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
