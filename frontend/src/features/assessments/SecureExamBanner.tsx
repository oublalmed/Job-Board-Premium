'use client';

import { AlertTriangle, Maximize, ShieldCheck } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import type { SecureExam } from './use-secure-exam';

/**
 * EF-EVAL-02 — candidate-facing surface for the browser-side deterrent
 * layer. Shows the active state of "secure exam mode", a re-enter-fullscreen
 * control, and an accessible warning whenever the candidate leaves fullscreen
 * or switches away from the tab/window during an in-progress attempt.
 *
 * The vendor-side anti-cheat (plagiarism, behavioural signals, question
 * rotation) is deliberately out of scope here — this component only reflects
 * what the browser can observe.
 */
export function SecureExamBanner({ exam }: { exam: SecureExam }) {
  const { t } = useLocale();
  if (!exam.active) return null;

  const leftTabOrWindow = exam.tabHidden || exam.windowBlurred;
  const showWarning = leftTabOrWindow || !exam.isFullscreen;

  return (
    <section
      aria-label={t('secureExam.title')}
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            {t('secureExam.title')}
          </span>
        </div>
        {!exam.isFullscreen && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void exam.enterFullscreen()}
          >
            <Maximize className="size-4" aria-hidden="true" />
            {t('secureExam.enterFullscreen')}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('secureExam.hint')}</p>

      {showWarning && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {leftTabOrWindow
                ? t('secureExam.warnLeftTab')
                : t('secureExam.warnNotFullscreen')}
            </span>
            {exam.leaveCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('secureExam.leaveCount', {
                  count: String(exam.leaveCount),
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
