'use client';

import { ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Badge } from '@/components/ui/badge';

// EF-CAND-03 — antivirus scan status for the uploaded CV. The scan is blocking
// server-side; surfacing its state tells the candidate whether their CV is
// usable, pending, or was rejected. Icon is decorative; the visible text
// carries the meaning (no colour-only signal, WCAG 1.4.1). Extracted from the
// profile page so it is unit-testable in isolation.
export function CvScanBadge({ status }: { status: string }) {
  const { t } = useLocale();
  const meta: Record<
    string,
    { variant: 'success' | 'warning' | 'destructive'; Icon: typeof Clock }
  > = {
    clean: { variant: 'success', Icon: ShieldCheck },
    pending: { variant: 'warning', Icon: Clock },
    infected: { variant: 'destructive', Icon: ShieldX },
  };
  const key = status in meta ? status : 'pending';
  const { variant, Icon } = meta[key];
  return (
    <Badge variant={variant} className="mt-1 gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {t(`profile.scanStatus.${key}`)}
    </Badge>
  );
}
