'use client';

import { useLocale } from '@/i18n/locale-context';
import type { BadgeLevel, PublicBadge } from './types';

const LEVEL_STYLES: Record<BadgeLevel, string> = {
  expert: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  advanced: 'bg-primary/15 text-primary',
  intermediate: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  beginner: 'bg-muted text-muted-foreground',
};

function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" className="shrink-0" role="img" aria-label={`${Math.round(value)} / 100`}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-muted" />
      <circle
        cx="65"
        cy="65"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
        transform="rotate(-90 65 65)"
      />
      <text x="65" y="60" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-3xl font-bold">
        {Math.round(value)}
      </text>
      <text x="65" y="86" textAnchor="middle" className="fill-muted-foreground text-[11px]">
        / 100
      </text>
    </svg>
  );
}

export function ScoreShowcase({ badge }: { badge: PublicBadge }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <ScoreRing value={badge.scoreValue} />
      <div className="flex flex-col items-center gap-1.5">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${LEVEL_STYLES[badge.level]}`}
        >
          {t(`badge.level.${badge.level}`)}
        </span>
        <h2 className="text-lg font-bold text-foreground">{badge.specialtyName}</h2>
        {badge.percentile != null && (
          <p className="text-sm text-muted-foreground">
            {t('badge.percentile', { value: String(Math.round(badge.percentile)) })}
          </p>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {badge.displayName || t('badge.anonymous')}
        </span>
        <span className="mx-1.5">·</span>
        {t('badge.issuedOn')} {new Date(badge.issuedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
