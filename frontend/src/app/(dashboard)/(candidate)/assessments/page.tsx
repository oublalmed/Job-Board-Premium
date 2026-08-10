'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  Play,
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { formatDateCasablanca } from '@/lib/format';
import {
  useAssessmentCatalog,
  useAssessmentFeedback,
  useReportIncident,
  useResumeAssessment,
  useStartAssessment,
} from '@/features/assessments/queries';
import {
  useAssessmentSession,
  type AssessmentStatus,
} from '@/features/assessments/session-store';
import {
  manualResumeSchema,
  EMPTY_MANUAL_RESUME,
  type ManualResumeValues,
} from '@/features/assessments/schema';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

// The backend's error bodies are English and untranslated — best-effort
// map the two known conflict shapes (cooldown, already-in-progress) to
// real French/English copy, falling back to the raw message.
function describeStartError(
  body: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
  locale: 'fr' | 'en',
): string {
  const b = body as { message?: string; reEligibleAt?: string } | undefined;
  const message = b?.message ?? '';
  if (b?.reEligibleAt) {
    return t('assessments.errors.cooldownActive', {
      date: formatDateCasablanca(new Date(b.reEligibleAt), locale),
    });
  }
  if (message.includes('already in progress')) {
    return t('assessments.errors.alreadyInProgress');
  }
  if (message) {
    return t('assessments.errors.prefixed', { message });
  }
  return t('common.error');
}

const STATUS_BADGE: Record<
  AssessmentStatus,
  { variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; key: string }
> = {
  pending: { variant: 'secondary', key: 'assessments.status.pending' },
  in_progress: { variant: 'default', key: 'assessments.status.inProgress' },
  completed: { variant: 'success', key: 'assessments.status.completed' },
  cancelled: { variant: 'secondary', key: 'assessments.status.cancelled' },
  incident: { variant: 'warning', key: 'assessments.status.incident' },
};

export default function AssessmentsPage() {
  const { t, locale } = useLocale();
  const { toast } = useToast();

  const catalog = useAssessmentCatalog();
  const specialties = catalog.data?.specialties ?? [];
  const tests = catalog.data?.tests ?? [];
  const composition = catalog.data?.composition ?? null;

  const { session, setSession, updateStatus } = useAssessmentSession();

  const start = useStartAssessment();
  const resume = useResumeAssessment();
  const incident = useReportIncident();
  const feedback = useAssessmentFeedback();

  const [showManual, setShowManual] = useState(false);
  const manualForm = useForm<ManualResumeValues>({
    resolver: zodResolver(manualResumeSchema),
    defaultValues: EMPTY_MANUAL_RESUME,
  });

  const startingTestId = start.isPending ? start.variables : null;

  function handleStart(testId: string) {
    start.mutate(testId, {
      onSuccess: (data) => {
        setSession({
          assessmentId: data.assessment.id,
          resumeToken: data.assessment.resumeToken,
          assessmentUrl: data.assessmentUrl,
          testId,
          status: data.assessment.status,
        });
        feedback.reset();
        toast(t('assessments.started'), 'success');
      },
      onError: (err) => {
        const body = err instanceof ApiError ? err.body : undefined;
        toast(describeStartError(body, t, locale), 'error');
      },
    });
  }

  const onManualResume = manualForm.handleSubmit((values) => {
    resume.mutate(values, {
      onSuccess: (data) => {
        setSession({
          assessmentId: data.assessment.id,
          resumeToken: data.assessment.resumeToken,
          assessmentUrl: data.assessmentUrl,
          testId: data.assessment.testId,
          status: data.assessment.status,
        });
        feedback.reset();
        toast(t('assessments.resumed'), 'success');
        manualForm.reset(EMPTY_MANUAL_RESUME);
        setShowManual(false);
      },
      onError: (err) => {
        const body = err instanceof ApiError ? err.body : undefined;
        toast(describeStartError(body, t, locale), 'error');
      },
    });
  });

  function handleReportIncident() {
    if (!session) return;
    incident.mutate(session.assessmentId, {
      onSuccess: (data) => {
        updateStatus(data.status);
        toast(t('assessments.incidentReported'), 'success');
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleViewFeedback() {
    if (!session) return;
    feedback.mutate(session.assessmentId, {
      onError: () => toast(t('assessments.feedbackError'), 'error'),
    });
  }

  const specialtyById = new Map(specialties.map((s) => [s.id, s]));
  const testsBySpecialty = new Map<string, typeof tests>();
  for (const test of tests) {
    const list = testsBySpecialty.get(test.specialtyId) ?? [];
    list.push(test);
    testsBySpecialty.set(test.specialtyId, list);
  }

  const feedbackData = feedback.data;

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('assessments.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('assessments.subtitle')}</p>
      </div>

      {session && (
        <Card className="overflow-hidden border-primary/30">
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Play className="size-5 text-primary" />
              {t('assessments.session.title')}
              <Badge variant={STATUS_BADGE[session.status].variant}>
                {t(STATUS_BADGE[session.status].key)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t('assessments.session.testLabel')}{' '}
              <span className="font-medium text-foreground">
                {specialtyById.get(
                  tests.find((tt) => tt.id === session.testId)?.specialtyId ?? '',
                )?.name ?? session.testId}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <a href={session.assessmentUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {t('assessments.session.continueButton')}
                </a>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleReportIncident}
                disabled={incident.isPending || session.status !== 'in_progress'}
              >
                {incident.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                {t('assessments.reportButton')}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleViewFeedback}
                disabled={feedback.isPending}
              >
                {feedback.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {t('assessments.viewFeedback')}
              </Button>
            </div>

            {feedbackData && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm font-medium text-foreground">
                    {t('assessments.feedbackResults')}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {t('assessments.feedback.score', { score: String(feedbackData.scoreValue) })}
                </p>
                {(feedbackData.technicalScore != null ||
                  feedbackData.psychotechnicalScore != null) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {feedbackData.technicalScore != null && (
                      <span>
                        {t('assessments.feedback.technicalScore', {
                          score: String(feedbackData.technicalScore),
                        })}
                      </span>
                    )}
                    {feedbackData.psychotechnicalScore != null && (
                      <span>
                        {t('assessments.feedback.psychotechnicalScore', {
                          score: String(feedbackData.psychotechnicalScore),
                        })}
                      </span>
                    )}
                  </div>
                )}
                {feedbackData.domainFeedback.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {feedbackData.domainFeedback.map((d) => (
                      <li key={d.domain}>
                        <Badge
                          variant={
                            d.level === 'strong'
                              ? 'success'
                              : d.level === 'medium'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {d.domain}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {feedbackData.reEligibleAt && (
                  <p className="text-xs text-muted-foreground">
                    {t('assessments.errors.cooldownActive', {
                      date: formatDateCasablanca(new Date(feedbackData.reEligibleAt), locale),
                    })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('assessments.catalog.title')}
          </h2>
          {composition && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
              <p className="text-sm text-muted-foreground">
                {t('assessments.composition.summary', {
                  technique: String(composition.techniqueWeight),
                  psychotechnique: String(composition.psychotechniqueWeight),
                })}
              </p>
              {composition.psychotechnicalItemTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {composition.psychotechnicalItemTypes.map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {catalog.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        )}

        {!catalog.isLoading && specialties.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('assessments.catalog.empty')}</p>
        )}

        {!catalog.isLoading && specialties.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {specialties.map((specialty) => {
              const specialtyTests = testsBySpecialty.get(specialty.id) ?? [];
              return specialtyTests.map((test, index) => (
                <Card key={test.id} className="transition-all duration-200 hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {specialty.name}
                        {specialtyTests.length > 1 ? ` — ${index + 1}` : ''}
                      </h3>
                      {specialty.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {specialty.description}
                        </p>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {t('assessments.catalog.duration', {
                        minutes: String(test.durationMinutes),
                      })}
                    </span>
                    <Button
                      className="mt-1 w-fit gap-2"
                      onClick={() => handleStart(test.id)}
                      disabled={startingTestId === test.id}
                    >
                      {startingTestId === test.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {t('assessments.startButton')}
                    </Button>
                  </CardContent>
                </Card>
              ));
            })}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <button
            type="button"
            className="flex w-full items-center justify-between text-start"
            onClick={() => setShowManual((p) => !p)}
            aria-expanded={showManual}
          >
            <CardTitle className="text-base">{t('assessments.manual.title')}</CardTitle>
            {showManual ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </CardHeader>
        {showManual && (
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{t('assessments.manual.hint')}</p>
            <Form {...manualForm}>
              <form
                onSubmit={(e) => void onManualResume(e)}
                className="flex flex-col gap-4 sm:flex-row sm:items-start"
              >
                <FormField
                  control={manualForm.control}
                  name="assessmentId"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('assessments.assessmentId')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('assessments.assessmentIdPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={manualForm.control}
                  name="resumeToken"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('assessments.resumeToken')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('assessments.resumeTokenPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={resume.isPending}
                  className="gap-2 sm:mt-[26px]"
                >
                  {resume.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('assessments.resumeButton')}
                </Button>
              </form>
            </Form>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
