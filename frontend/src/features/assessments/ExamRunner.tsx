'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ClipboardCheck,
  Check,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAssessmentExam, useSubmitExam, type ExamQuestion } from './queries';

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
  const pct = Math.max(0, Math.min(100, (left / seconds) * 100));

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
          low ? 'text-destructive' : 'text-foreground',
        )}
        role="timer"
        aria-live={low ? 'assertive' : 'off'}
        aria-label={t('assessments.exam.timeLeft')}
      >
        <Timer className={cn('size-4', low && 'animate-pulse')} />
        {formatClock(left)}
      </span>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            low ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// The exam: a 30-question QCM presented one question at a time, each with a
// server-defined time limit. When a question's time runs out (or the candidate
// clicks Next) the exam advances; navigation is forward-only. The final answers
// are submitted together and graded server-side.
export function ExamRunner({
  assessmentId,
  onCompleted,
}: {
  assessmentId: string;
  onCompleted: () => void;
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
        onError: () => {
          doneRef.current = false;
          toast(t('common.error'), 'error');
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        {t('assessments.exam.loadError')}
      </p>
    );
  }

  const question: ExamQuestion = data.questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index + 1 >= total;
  const progressPct = ((index + 1) / total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="size-4 text-primary" />
          {t('assessments.exam.title')}
        </h3>
        {/* Fresh timer per question (keyed remount). */}
        <QuestionTimer
          key={question.id}
          seconds={question.timeLimitSeconds}
          onExpire={advance}
        />
      </div>

      {/* Overall progress through the exam. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tabular-nums">
            {t('assessments.exam.counter', {
              n: String(index + 1),
              total: String(total),
            })}
          </span>
          <span className="tabular-nums">
            {t('assessments.exam.progress', {
              done: String(answeredCount),
              total: String(total),
            })}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('assessments.exam.timerHint')}
      </p>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={question.type === 'technical' ? 'default' : 'secondary'}>
            {question.type === 'technical'
              ? t('assessments.exam.technical')
              : t('assessments.exam.psychotechnical')}
          </Badge>
          <Badge variant="outline">{question.domain}</Badge>
        </div>
        <p className="mb-3 text-sm font-medium text-foreground">
          {question.prompt}
        </p>
        <div className="flex flex-col gap-2" role="radiogroup">
          {question.options.map((opt, idx) => {
            const selected = answers[question.id] === idx;
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setAnswers((a) => ({ ...a, [question.id]: idx }))
                }
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40',
                  )}
                >
                  {selected && <Check className="size-3" />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {t('assessments.exam.forwardOnly')}
        </span>
        <Button
          className="gap-2"
          onClick={advance}
          disabled={submit.isPending}
        >
          {submit.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLast ? (
            <ClipboardCheck className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {isLast
            ? t('assessments.exam.finish')
            : t('assessments.exam.next')}
        </Button>
      </div>
    </div>
  );
}
