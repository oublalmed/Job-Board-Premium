'use client';

import { Trophy } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';

/**
 * CDC EF-RECR-04 — the recruiter search is ordered by the candidate's best
 * evaluation score (descending). `percentile` is the share of candidates at or
 * below this one, so the recruiter-facing "top X%" is its complement, clamped
 * to a sane 1–100 band (a 100th-percentile candidate is "top 1%", never
 * "top 0%").
 */
export function topPercentile(percentile: number): number {
  return Math.max(1, Math.min(100, Math.round(100 - percentile)));
}

/**
 * CDC EF-RECR-04 — makes the ranking a search row carries *explicit*: its
 * position in the score-ordered list (`rank`), the numeric score itself and,
 * when known, the percentile band. Presentation only; the ordering is decided
 * by the backend. A candidate with no eligible score renders a neutral,
 * non-alarming placeholder rather than a misleading "0".
 *
 * Accessibility: the visible chips are aria-hidden and a single composed
 * `aria-label` on the wrapper is what assistive tech announces, so the ranking
 * is never conveyed by colour/position alone (WCAG 1.4.1).
 */
export function CandidateScoreBadge({
  score,
  percentile,
  rank,
}: {
  score?: number;
  percentile?: number | null;
  rank?: number;
}) {
  const { t } = useLocale();
  const hasScore = typeof score === 'number' && score > 0;

  if (!hasScore) {
    return (
      <span
        className="inline-flex items-center text-xs text-muted-foreground"
        title={t('search.noScore')}
      >
        {t('search.noScore')}
      </span>
    );
  }

  const rounded = Math.round(score);
  const top = typeof percentile === 'number' ? topPercentile(percentile) : null;

  const ariaLabel = [
    typeof rank === 'number' ? t('search.rankPosition', { rank: String(rank) }) : null,
    `${t('search.score')}: ${rounded}/100`,
    top !== null ? t('search.topPercent', { pct: String(top) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
      aria-label={ariaLabel}
    >
      <Trophy className="size-3 shrink-0" aria-hidden="true" />
      {typeof rank === 'number' && (
        <span className="tabular-nums" aria-hidden="true">
          #{rank}
        </span>
      )}
      <span className="tabular-nums" aria-hidden="true">
        {rounded}/100
      </span>
      {top !== null && (
        <span className="text-primary/70" aria-hidden="true">
          · {t('search.topShort')} {top}%
        </span>
      )}
    </span>
  );
}
