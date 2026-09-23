'use client';

import { Lock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';

/**
 * Subtle, non-interactive caption for anonymised search rows (CDC EF-SRCH-05):
 * the family name is masked in the list and only revealed on contact. The
 * visible text is the accessible name, so the lock icon is aria-hidden; the
 * same text is mirrored into `title` as a hover tooltip.
 */
export function AnonymizedHint() {
  const { t } = useLocale();
  const label = t('search.anonymizedHint');
  return (
    <span
      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={label}
    >
      <Lock className="size-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
