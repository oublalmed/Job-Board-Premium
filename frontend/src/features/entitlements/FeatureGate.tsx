'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { useEntitlements, type Feature } from './queries';

// §14 — the default "not in your plan" state. Never fabricates data; invites an
// upgrade instead.
export function FeatureLocked() {
  const { t } = useLocale();
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t('entitlements.noAccessTitle')}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t('entitlements.noAccessBody')}
        </p>
      </CardContent>
    </Card>
  );
}

// §13/§14 — render children only when the feature is enabled for the caller's
// company; otherwise show `fallback` (or the default locked state). This is UI
// gating only — the backend FeatureGuard is the real enforcement (§22 rule #4).
export function FeatureGate({
  feature,
  children,
  fallback,
  loading = null,
}: {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}) {
  const { data, isLoading } = useEntitlements();
  if (isLoading) return <>{loading}</>;
  const enabled = data?.features?.[feature]?.enabled ?? false;
  if (enabled) return <>{children}</>;
  return <>{fallback ?? <FeatureLocked />}</>;
}
