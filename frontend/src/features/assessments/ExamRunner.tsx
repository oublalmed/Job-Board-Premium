'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ClipboardCheck,
  Check,
  Timer,
  ArrowRight,
  Maximize2,
  Flag,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { useAssessmentExam, useSubmitExam, type ExamQuestion } from './queries';
import type { SecureExam } from './use-secure-exam';

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// §1 — a self-contained per-question countdown. Keyed by question id in the
// parent, so it remounts (and resets) on every question. Calls `onExpire`
// exactly once when it reaches zero.
function QuestionTimer({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const { t } = useLocale();
  const [left, setLeft] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onExpireRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const low = left <= 10;

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-lg font-semibold tabular-nums',
        low ? 'text-destructive' : 'text-foreground',
      )}
      role="timer"
      aria-live={low ? 'assertive' : 'off'}
      aria-label={t('assessments.exam.timeLeft')}
    >
      <Timer className={cn('size-5', low && 'animate-pulse')} />
      {formatClock(left)}
    </span>
  );
}

// §1 / §14 — the exam takes over the whole screen: a 30-question QCM shown one
// question at a time, each with a server-defined time limit. Nothing else is
// displayed (no dashboard chrome). When a question's time runs out (or the
// candidate clicks Next) the exam advances; navigation is forward-only, and the
// answers are submitted together and graded server-side.
export function ExamRunner({
  assessmentId,
  onCompleted,
  onInvalidated,
  secureExam,
  onReportIncident,
  reportPending = false,
}: {
  assessmentId: string;
  onCompleted: () => void;
  // Called when the server voids the attempt (e.g. 403 TIME_EXCEEDED on submit).
  onInvalidated?: (reason: 'time') => void;
  secureExam?: SecureExam;
  onReportIncident?: () => void;
  reportPending?: boolean;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading, isError } = useAssessmentExam(assessmentId, true);
  const submit = useSubmitExam();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const doneRef = useRef(false);

  const total = data?.questions.length ?? 0;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    submit.mutate(
      { assessmentId, answers },
      {
        onSuccess: () => {
          toast(t('assessments.exam.submitted'), 'success');
          onCompleted();
        },
        onError: (err) => {
          doneRef.current = false;
          // Server voided the attempt (time budget exceeded) → let the parent
          // close the exam and show the invalidation notice.
          if (err instanceof ApiError && err.status === 403) {
            onInvalidated?.('time');
          } else {
            toast(t('common.error'), 'error');
          }
        },
      },
    );
    // `answers` is read at call time via the latest closure; advancing always
    // re-creates this callback because `index` changes with each question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, answers, index]);

  const advance = useCallback(() => {
    if (doneRef.current) return;
    if (index + 1 < total) {
      setIndex((i) => i + 1);
    } else {
      finish();
    }
  }, [index, total, finish]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-destructive">
            {t('assessments.exam.loadError')}
          </p>
        </div>
      ) : (
        <ExamBody
          data={data}
          index={index}
          answers={answers}
          onSelect={(qid, idx) =>
            setAnswers((a) => ({ ...a, [qid]: idx }))
          }
          onAdvance={advance}
          submitting={submit.isPending}
          secureExam={secureExam}
          onReportIncident={onReportIncident}
          reportPending={reportPending}
        />
      )}
    </div>
  );
}

function ExamBody({
  data,
  index,
  answers,
  onSelect,
  onAdvance,
  submitting,
  secureExam,
  onReportIncident,
  reportPending,
}: {
  data: { questions: ExamQuestion[] };
  index: number;
  answers: Record<string, number>;
  onSelect: (questionId: string, optionIndex: number) => void;
  onAdvance: () => void;
  submitting: boolean;
  secureExam?: SecureExam;
  onReportIncident?: () => void;
  reportPending: boolean;
}) {
  const { t } = useLocale();
  const total = data.questions.length;
  const question = data.questions[index];
  const isLast = index + 1 >= total;
  const progressPct = ((index + 1) / total) * 100;
  const notFullscreen = secureExam && !secureExam.isFullscreen;

  return (
    <>
      {/* Minimal top bar: which question + the countdown. */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ClipboardCheck className="size-4 text-primary" />
          <span className="tabular-nums">
            {t('assessments.exam.counter', {
              n: String(index + 1),
              total: String(total),
            })}
          </span>
        </span>
        <QuestionTimer
          key={question.id}
          seconds={question.timeLimitSeconds}
          onExpire={onAdvance}
        />
      </header>
      {/* Overall progress. */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Warn (and offer to re-enter) if the candidate leaves fullscreen. */}
      {notFullscreen && (
        <button
          type="button"
          onClick={() => void secureExam?.enterFullscreen()}
          className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-xs font-medium text-warning-foreground hover:bg-warning/25"
        >
          <Maximize2 className="size-3.5" />
          {t('assessments.exam.fullscreenPrompt')}
        </button>
      )}

      {/* The question — the only real content on screen. */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={question.type === 'technical' ? 'default' : 'secondary'}
            >
              {question.type === 'technical'
                ? t('assessments.exam.technical')
                : t('assessments.exam.psychotechnical')}
            </Badge>
            <Badge variant="outline">{question.domain}</Badge>
          </div>

          <h2 className="text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
            {question.prompt}
          </h2>

          <div className="flex flex-col gap-3" role="radiogroup">
            {question.options.map((opt, idx) => {
              const selected = answers[question.id] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(question.id, idx)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-start text-sm transition-colors sm:text-base',
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-foreground hover:border-primary/40 hover:bg-accent',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {selected && <Check className="size-3.5" />}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer: advance (primary) + a discreet incident escape. */}
      <footer className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-4 sm:px-6">
        {onReportIncident ? (
          <button
            type="button"
            onClick={onReportIncident}
            disabled={reportPending}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {reportPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Flag className="size-3.5" />
            )}
            {t('assessments.reportButton')}
          </button>
        ) : (
          <span />
        )}

        <Button className="gap-2" size="lg" onClick={onAdvance} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLast ? (
            <ClipboardCheck className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {isLast ? t('assessments.exam.finish') : t('assessments.exam.next')}
        </Button>
      </footer>
    </>
  );
}
