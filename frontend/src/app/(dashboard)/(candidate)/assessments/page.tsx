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
  useAssessmentFeedbackQuery,
  useUpdateRemediationProgress,
  useAssessmentHistory,
  useReportIncident,
  useResumeAssessment,
  useStartAssessment,
  type AssessmentHistoryItem,
} from '@/features/assessments/queries';
import {
  useAssessmentSession,
  type AssessmentStatus,
} from '@/features/assessments/session-store';
import { useSecureExam } from '@/features/assessments/use-secure-exam';
import { SecureExamBanner } from '@/features/assessments/SecureExamBanner';
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

  // EF-EVAL-02 — browser-side deterrent layer, active only while an attempt
  // is genuinely in progress.
  const secureExam = useSecureExam(session?.status === 'in_progress');

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
        // EF-EVAL-02 — best-effort fullscreen entry on start; the secure-exam
        // banner exposes a reliable gesture-driven fallback if the browser
        // denies this deferred (post-mutation) request.
        if (data.assessment.status === 'in_progress') {
          void secureExam.enterFullscreen();
        }
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
            <SecureExamBanner exam={secureExam} />
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
                {/* EF-REM-04 — the candidate is told whether their profile is
                    highlighted in the CVthèque or merely visible. */}
                <p className="text-xs text-muted-foreground">
                  {feedbackData.indexationThresholdMet
                    ? t('assessments.feedback.highlighted')
                    : t('assessments.feedback.visibleNotHighlighted')}
                </p>
                {/* EF-REM-02 — targeted resources to improve weak domains. */}
                {feedbackData.resources.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium text-foreground">
                      {t('assessments.feedback.resourcesTitle')}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {feedbackData.resources.map((r) => (
                        <li key={r.url}>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline underline-offset-4"
                          >
                            {r.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
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

      <AssessmentHistorySection />

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

// EF-EVAL-03 — a normalized 0–100 score rendered as an accessible meter, so the
// value reads as a proportion of the scale at a glance. The bar is a
// progressbar with a text alternative; it never conveys meaning by colour or
// width alone (the numeric value is always shown).
function ScoreMeter({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const rounded = Math.round(value);
  const pct = Math.max(0, Math.min(100, (rounded / max) * 100));
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {rounded}/{max}
      </span>
      <div
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${rounded}/${max}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// EF-EVAL-04 — percentile as a ranking, not a bare number. A percentile of P
// means the candidate scored at or above P % of the active cohort; the bar
// fills to P and the caption states the ranking in words.
function PercentileBar({
  label,
  rankLabel,
  percentile,
}: {
  label: string;
  rankLabel: string;
  percentile: number;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percentile)));
  return (
    <div className="col-span-2 flex flex-col gap-1.5 rounded-lg border border-border/60 px-3 py-2 sm:col-span-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{rankLabel}</span>
      <div
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rankLabel}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function HistoryRow({ item }: { item: AssessmentHistoryItem }) {
  const { t, locale } = useLocale();
  const badge = STATUS_BADGE[item.status];
  const [open, setOpen] = useState(false);
  // EF-CAND-09 — remediation guidance for a past completed attempt, fetched
  // lazily only when the candidate expands the row.
  const isCompleted = item.status === 'completed';
  const feedback = useAssessmentFeedbackQuery(item.id, open && isCompleted);
  const fb = feedback.data;
  // EF-CAND-09 — toggle completion of a remediation resource.
  const progress = useUpdateRemediationProgress(item.id);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {item.specialtyName ?? t('assessments.title')}
          </span>
          {item.completedAt && (
            <span className="text-xs text-muted-foreground">
              {t('assessments.history.completedOn', {
                date: formatDateCasablanca(new Date(item.completedAt), locale),
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{t(badge.key)}</Badge>
          {isCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open
                ? t('assessments.history.hideRemediation')
                : t('assessments.history.viewRemediation')}
            </Button>
          )}
        </div>
      </div>
      {item.score && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ScoreMeter
            label={t('assessments.history.composite')}
            value={item.score.value}
          />
          {item.score.technicalScore != null && (
            <ScoreMeter
              label={t('assessments.history.technical')}
              value={item.score.technicalScore}
            />
          )}
          {item.score.psychotechnicalScore != null && (
            <ScoreMeter
              label={t('assessments.history.psychotechnical')}
              value={item.score.psychotechnicalScore}
            />
          )}
          {item.score.percentile != null && (
            <PercentileBar
              label={t('assessments.history.ranking')}
              rankLabel={t('assessments.history.rankingTop', {
                value: String(Math.max(1, 100 - Math.round(item.score.percentile))),
              })}
              percentile={item.score.percentile}
            />
          )}
        </div>
      )}
      {item.score?.expiresAt && (
        <p className="text-xs text-muted-foreground">
          {t('assessments.history.scoreExpires', {
            date: new Date(item.score.expiresAt).toLocaleDateString(),
          })}
        </p>
      )}
      {open && isCompleted && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          {feedback.isLoading && (
            <p className="text-xs text-muted-foreground">
              {t('common.loading')}
            </p>
          )}
          {feedback.isError && (
            <p className="text-xs text-destructive">{t('common.error')}</p>
          )}
          {fb && (
            <>
              {fb.domainFeedback.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {fb.domainFeedback.map((d) => (
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
              <p className="text-xs text-muted-foreground">
                {fb.indexationThresholdMet
                  ? t('assessments.feedback.highlighted')
                  : t('assessments.feedback.visibleNotHighlighted')}
              </p>
              {fb.resources.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-foreground">
                    {t('assessments.feedback.resourcesTitle')}{' '}
                    <span className="font-normal text-muted-foreground">
                      {t('assessments.feedback.resourcesProgress', {
                        done: String(fb.completedCount),
                        total: String(fb.totalCount),
                      })}
                    </span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {fb.resources.map((r, idx) => {
                      const inputId = `remediation-${item.id}-${idx}`;
                      return (
                        <li key={r.url} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={inputId}
                            checked={r.completed}
                            disabled={progress.isPending}
                            onChange={(e) =>
                              progress.mutate({
                                url: r.url,
                                completed: e.target.checked,
                              })
                            }
                            className="size-3.5 shrink-0 accent-primary"
                          />
                          <label htmlFor={inputId} className="text-xs">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline underline-offset-4"
                            >
                              {r.title}
                            </a>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function AssessmentHistorySection() {
  const { t, locale } = useLocale();
  const { data, isLoading } = useAssessmentHistory();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('assessments.history.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('assessments.history.empty')}
          </p>
        ) : (
          <>
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                data.eligibleNow
                  ? 'border-success/30 bg-success/10 text-foreground'
                  : 'border-warning/30 bg-warning/10 text-foreground'
              }`}
            >
              {data.eligibleNow ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <Clock className="mt-0.5 size-4 shrink-0 text-warning" />
              )}
              <span>
                {data.eligibleNow
                  ? t('assessments.history.eligibleNow')
                  : data.nextEligibleAt
                    ? t('assessments.history.nextEligible', {
                        date: formatDateCasablanca(
                          new Date(data.nextEligibleAt),
                          locale,
                        ),
                      })
                    : t('assessments.history.cooldownInfo', {
                        days: String(data.cooldownDays),
                      })}
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {data.items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
