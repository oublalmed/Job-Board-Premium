'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import type { components } from '@/api/schema';

type Specialty = components['schemas']['SpecialtySummaryDto'];
type TestSummary = components['schemas']['TestSummaryDto'];
type RemediationFeedback = components['schemas']['RemediationFeedbackDto'];
type AssessmentStatus = components['schemas']['Assessment']['status'];

interface EvaluationComposition {
  techniqueWeight: number;
  psychotechniqueWeight: number;
  psychotechnicalItemTypes: string[];
}

interface Session {
  assessmentId: string;
  resumeToken: string | null;
  assessmentUrl: string;
  testId: string;
  status: AssessmentStatus;
}

const SESSION_KEY = 'jbp_assessment_session';

// No GET /assessments (list-mine) endpoint exists — confirmed absent
// (only start/resume/incident/:id/feedback, all requiring an ID the
// caller already has). sessionStorage is the only way this page can
// survive a refresh without asking the candidate to retype IDs; it is
// a real, disclosed limit (a different tab/device genuinely can't
// recover a session), not something worked around here.
function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

// The backend's error bodies are English, untranslated (a real backend
// gap, not something this page can paper over) — best-effort maps the
// two known real conflict shapes to real French copy, falls back to
// showing the raw backend message rather than a silent/generic error.
function describeStartError(
  error: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
  locale: 'fr' | 'en',
): string {
  const body = error as { message?: string; reEligibleAt?: string } | undefined;
  const message = body?.message ?? '';
  if (body?.reEligibleAt) {
    return t('assessments.errors.cooldownActive', {
      date: formatDateCasablanca(new Date(body.reEligibleAt), locale),
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

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [startingTestId, setStartingTestId] = useState<string | null>(null);
  const [composition, setComposition] = useState<EvaluationComposition | null>(null);

  // Lazy initializer, not a mount effect + setState: sessionStorage is
  // already available at first client render (this file is 'use
  // client', loadSession() itself guards the `window === undefined`
  // SSR case), so there's nothing to "synchronize" here.
  const [session, setSession] = useState<Session | null>(loadSession);
  const [reportingIncident, setReportingIncident] = useState(false);
  const [feedback, setFeedback] = useState<RemediationFeedback | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manualAssessmentId, setManualAssessmentId] = useState('');
  const [manualResumeToken, setManualResumeToken] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const [{ data: specialtiesData }, { data: testsData }, { data: compositionData }] =
        await Promise.all([
          apiClient.GET('/api/v1/specialties'),
          apiClient.GET('/api/v1/tests'),
          apiClient.GET('/api/v1/assessments/composition'),
        ]);
      setSpecialties(specialtiesData ?? []);
      setTests(testsData ?? []);
      if (compositionData) {
        setComposition(compositionData as unknown as EvaluationComposition);
      }
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  function applySession(next: Session) {
    setSession(next);
    saveSession(next);
    setFeedback(null);
  }

  async function handleStart(testId: string) {
    setStartingTestId(testId);
    try {
      const { data, error } = await apiClient.POST('/api/v1/assessments/start', {
        body: { testId },
      });
      if (error || !data) {
        toast(describeStartError(error, t, locale), 'error');
        return;
      }
      applySession({
        assessmentId: data.assessment.id,
        resumeToken: data.assessment.resumeToken,
        assessmentUrl: data.assessmentUrl,
        testId,
        status: data.assessment.status,
      });
      toast(t('assessments.started'), 'success');
    } finally {
      setStartingTestId(null);
    }
  }

  async function handleManualResume(e: FormEvent) {
    e.preventDefault();
    if (!manualAssessmentId.trim() || !manualResumeToken.trim()) return;
    setManualBusy(true);
    try {
      const { data, error } = await apiClient.POST('/api/v1/assessments/resume', {
        body: {
          assessmentId: manualAssessmentId.trim(),
          resumeToken: manualResumeToken.trim(),
        },
      });
      if (error || !data) {
        toast(describeStartError(error, t, locale), 'error');
        return;
      }
      applySession({
        assessmentId: data.assessment.id,
        resumeToken: data.assessment.resumeToken,
        assessmentUrl: data.assessmentUrl,
        testId: data.assessment.testId,
        status: data.assessment.status,
      });
      toast(t('assessments.resumed'), 'success');
      setManualAssessmentId('');
      setManualResumeToken('');
      setShowManual(false);
    } finally {
      setManualBusy(false);
    }
  }

  async function handleReportIncident() {
    if (!session) return;
    setReportingIncident(true);
    try {
      const { data, error } = await apiClient.POST(
        '/api/v1/assessments/{id}/incident',
        { params: { path: { id: session.assessmentId } } },
      );
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('assessments.incidentReported'), 'success');
      if (data) {
        applySession({ ...session, status: data.status });
      }
    } finally {
      setReportingIncident(false);
    }
  }

  async function handleViewFeedback(assessmentId: string) {
    setLoadingFeedback(true);
    setFeedback(null);
    try {
      const { data, error } = await apiClient.GET(
        '/api/v1/assessments/{id}/feedback',
        { params: { path: { id: assessmentId } } },
      );
      if (error || !data) {
        toast(t('assessments.feedbackError'), 'error');
        return;
      }
      setFeedback(data);
    } finally {
      setLoadingFeedback(false);
    }
  }

  const specialtyById = new Map(specialties.map((s) => [s.id, s]));
  const testsBySpecialty = new Map<string, TestSummary[]>();
  for (const test of tests) {
    const list = testsBySpecialty.get(test.specialtyId) ?? [];
    list.push(test);
    testsBySpecialty.set(test.specialtyId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('assessments.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('assessments.subtitle')}
        </p>
      </div>

      {session && (
        <Card className="border-primary/30">
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
                onClick={() => void handleReportIncident()}
                disabled={reportingIncident || session.status !== 'in_progress'}
              >
                {reportingIncident ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                {t('assessments.reportButton')}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleViewFeedback(session.assessmentId)}
                disabled={loadingFeedback}
              >
                {loadingFeedback ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {t('assessments.viewFeedback')}
              </Button>
            </div>

            {feedback && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {t('assessments.feedbackResults')}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {t('assessments.feedback.score', {
                    score: String(feedback.scoreValue),
                  })}
                </p>
                {(feedback.technicalScore != null || feedback.psychotechnicalScore != null) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {feedback.technicalScore != null && (
                      <span>
                        {t('assessments.feedback.technicalScore', {
                          score: String(feedback.technicalScore),
                        })}
                      </span>
                    )}
                    {feedback.psychotechnicalScore != null && (
                      <span>
                        {t('assessments.feedback.psychotechnicalScore', {
                          score: String(feedback.psychotechnicalScore),
                        })}
                      </span>
                    )}
                  </div>
                )}
                {feedback.domainFeedback.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {feedback.domainFeedback.map((d) => (
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
                {feedback.reEligibleAt && (
                  <p className="text-xs text-muted-foreground">
                    {t('assessments.errors.cooldownActive', {
                      date: formatDateCasablanca(
                        new Date(feedback.reEligibleAt),
                        locale,
                      ),
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
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-border/50 bg-muted/30 p-3">
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

        {loadingCatalog && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        )}

        {!loadingCatalog && specialties.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('assessments.catalog.empty')}
          </p>
        )}

        {!loadingCatalog && specialties.length > 0 && (
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
                      onClick={() => void handleStart(test.id)}
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
            onClick={() => setShowManual((prev) => !prev)}
          >
            <CardTitle className="text-base">
              {t('assessments.manual.title')}
            </CardTitle>
            {showManual ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </CardHeader>
        {showManual && (
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {t('assessments.manual.hint')}
            </p>
            <form
              onSubmit={(e) => void handleManualResume(e)}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="manual-assessment-id">
                  {t('assessments.assessmentId')}
                </Label>
                <Input
                  id="manual-assessment-id"
                  value={manualAssessmentId}
                  onChange={(e) => setManualAssessmentId(e.target.value)}
                  placeholder={t('assessments.assessmentIdPlaceholder')}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="manual-resume-token">
                  {t('assessments.resumeToken')}
                </Label>
                <Input
                  id="manual-resume-token"
                  value={manualResumeToken}
                  onChange={(e) => setManualResumeToken(e.target.value)}
                  placeholder={t('assessments.resumeTokenPlaceholder')}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={
                  manualBusy || !manualAssessmentId.trim() || !manualResumeToken.trim()
                }
                className="gap-2"
              >
                {manualBusy && <Loader2 className="size-4 animate-spin" />}
                {t('assessments.resumeButton')}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
