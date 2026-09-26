'use client';

import { useState } from 'react';
import { Loader2, ClipboardCheck, Check } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAssessmentExam, useSubmitExam } from './queries';

// The actual exam: a 30-question QCM. Renders each question with selectable
// options and submits the chosen indices for grading. Shown while in progress.
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
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
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
  const answered = Object.keys(answers).length;

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
        {t('assessments.exam.qcmHint')}
      </p>

      <ol className="flex flex-col gap-4">
        {data.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('assessments.exam.questionLabel', { n: String(i + 1) })}
              </span>
              <Badge variant={q.type === 'technical' ? 'default' : 'secondary'}>
                {q.type === 'technical'
                  ? t('assessments.exam.technical')
                  : t('assessments.exam.psychotechnical')}
              </Badge>
              <Badge variant="outline">{q.domain}</Badge>
            </div>
            <p className="mb-3 text-sm font-medium text-foreground">{q.prompt}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, idx) => {
                const selected = answers[q.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-accent'
                    }`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="gap-2"
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
        {answered < total && (
          <span className="text-xs text-muted-foreground">
            {t('assessments.exam.unanswered', {
              count: String(total - answered),
            })}
          </span>
        )}
      </div>
    </div>
  );
}
