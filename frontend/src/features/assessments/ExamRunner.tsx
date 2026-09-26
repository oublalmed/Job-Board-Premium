'use client';

import { useState } from 'react';
import { Loader2, ClipboardCheck, Clock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAssessmentExam, useSubmitExam } from './queries';

// A substantive answer mirrors the backend's grading threshold (>= 40 chars and
// >= 8 words), so the progress counter reflects what will actually be scored.
function isSubstantive(v: string): boolean {
  const a = v.trim();
  return a.length >= 40 && a.split(/\s+/).filter(Boolean).length >= 8;
}

// The actual exam: renders the open-ended questions with a text answer each and
// submits them for grading. Shown while an attempt is in progress.
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
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
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

  const total = data.questions.length;
  const answered = data.questions.filter((q) =>
    isSubstantive(answers[q.id] ?? ''),
  ).length;

  function onSubmit() {
    submit.mutate(
      { assessmentId, answers },
      {
        onSuccess: () => {
          toast(t('assessments.exam.submitted'), 'success');
          onCompleted();
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="size-4 text-primary" />
          {t('assessments.exam.title')}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {t('assessments.exam.progress', {
            done: String(answered),
            total: String(total),
          })}
        </span>
      </div>
      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('assessments.exam.openHint')}
      </p>

      <ol className="flex flex-col gap-4">
        {data.questions.map((q, i) => (
          <li
            key={q.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('assessments.exam.questionLabel', { n: String(i + 1) })}
              </span>
              <Badge variant={q.type === 'technical' ? 'default' : 'secondary'}>
                {q.category}
              </Badge>
              <Badge variant="outline">{q.domain}</Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {t('assessments.exam.suggestedTime', {
                  seconds: String(q.timeSeconds),
                })}
              </span>
            </div>
            <p className="mb-3 text-sm font-medium text-foreground">
              {q.prompt}
            </p>
            <textarea
              rows={4}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder={t('assessments.exam.answerPlaceholder')}
              value={answers[q.id] ?? ''}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
            />
          </li>
        ))}
      </ol>

      <Button
        className="gap-2 self-start"
        onClick={onSubmit}
        disabled={submit.isPending}
      >
        {submit.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ClipboardCheck className="size-4" />
        )}
        {t('assessments.exam.submit')}
      </Button>
    </div>
  );
}
