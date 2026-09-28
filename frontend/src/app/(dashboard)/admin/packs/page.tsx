'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Loader2, RotateCcw } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAssignableCompanies } from '@/features/admin/subscriptions';
import {
  useCompanyEntitlements,
  useSetFeatureOverride,
  useClearFeatureOverride,
} from '@/features/admin/entitlements';
import type { Feature } from '@/features/entitlements/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

// Admin-facing technical label for a feature/limit key.
function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminPacksPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data: companies } = useAssignableCompanies();
  const [companyId, setCompanyId] = useState('');

  const ent = useCompanyEntitlements(companyId || null);
  const setOverride = useSetFeatureOverride(companyId);
  const clearOverride = useClearFeatureOverride(companyId);

  function force(feature: Feature, enabled: boolean) {
    setOverride.mutate(
      { feature, enabled },
      {
        onSuccess: () => toast(t('adminPacks.saved'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }
  function reset(feature: Feature) {
    clearOverride.mutate(feature, {
      onSuccess: () => toast(t('adminPacks.saved'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const data = ent.data;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Package className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminPacks.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('adminPacks.subtitle')}
          </p>
        </div>
      </div>

      <label className="flex max-w-md flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t('adminPacks.selectCompany')}
        </span>
        <select
          className={fieldClass}
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">{t('adminPacks.selectPlaceholder')}</option>
          {(companies ?? []).map((c) => (
            <option key={c.companyId} value={c.companyId}>
              {c.companyName}
            </option>
          ))}
        </select>
      </label>

      {ent.isLoading && companyId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {data && (
        <>
          {/* Pack summary + limits + usage (§12) */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('adminPacks.plan')}
                </p>
                <p className="text-base font-semibold text-foreground">
                  {data.planDisplayName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('adminPacks.status')}
                </p>
                <Badge variant={data.active ? 'default' : 'secondary'}>
                  {data.active
                    ? t('adminPacks.statusActive')
                    : t('adminPacks.statusInactive')}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('adminPacks.users')}
                </p>
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {data.usage.users}
                  {data.limits.max_users != null
                    ? ` / ${data.limits.max_users}`
                    : ' / ∞'}
                </p>
              </div>
              {Object.entries(data.limits)
                .filter(([k]) => k !== 'max_users')
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">
                      {humanize(k)}
                    </p>
                    <p className="text-sm font-medium text-foreground tabular-nums">
                      {v == null ? '∞' : v}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Features + override controls (§12) */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-sm font-semibold text-foreground">
                  {t('adminPacks.features')}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {(
                  Object.entries(data.features) as [
                    Feature,
                    { enabled: boolean; source: string },
                  ][]
                ).map(([feature, state]) => (
                  <li
                    key={feature}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={state.enabled ? 'default' : 'outline'}
                        className={state.enabled ? '' : 'text-muted-foreground'}
                      >
                        {state.enabled
                          ? t('adminPacks.enabled')
                          : t('adminPacks.disabled')}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {humanize(feature)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {state.source === 'admin_override'
                          ? t('adminPacks.sourceOverride')
                          : t('adminPacks.sourcePackage')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {state.enabled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => force(feature, false)}
                          disabled={setOverride.isPending}
                        >
                          {t('adminPacks.forceDisable')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => force(feature, true)}
                          disabled={setOverride.isPending}
                        >
                          {t('adminPacks.forceEnable')}
                        </Button>
                      )}
                      {state.source === 'admin_override' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                          onClick={() => reset(feature)}
                          disabled={clearOverride.isPending}
                        >
                          <RotateCcw className="size-3.5" />
                          {t('adminPacks.resetToPlan')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
