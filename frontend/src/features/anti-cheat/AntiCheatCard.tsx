'use client';

import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeature } from '@/features/entitlements/queries';
import { useCandidateIntegrity, type SuspicionLevel } from './queries';

const LEVEL_STYLE: Record<
  SuspicionLevel,
  { variant: 'default' | 'secondary' | 'destructive'; icon: typeof ShieldCheck }
> = {
  low: { variant: 'secondary', icon: ShieldCheck },
  medium: { variant: 'default', icon: ShieldAlert },
  high: { variant: 'destructive', icon: ShieldX },
};

// §2.3 — anti-cheat indicators for a candidate, shown only to recruiters whose
// pack includes ANTI_CHEAT (gated). Never labels the candidate a "fraudster" —
// it surfaces suspicion indicators for a human to judge.
export function AntiCheatCard({
  candidateProfileId,
}: {
  candidateProfileId: string;
}) {
  const { t } = useLocale();
  const hasFeature = useFeature('anti_cheat');
  const { data } = useCandidateIntegrity(candidateProfileId, hasFeature);

  // Not entitled, or nothing to show yet → render nothing (§14, no fabrication).
  if (!hasFeature || !data) return null;

  const { icon: Icon, variant } = LEVEL_STYLE[data.level];

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="size-4 text-primary" />
            {t('antiCheat.title')}
          </h3>
          {data.antiCheatEnabled ? (
            <Badge variant={variant}>{t(`antiCheat.level_${data.level}`)}</Badge>
          ) : (
            <Badge variant="outline">{t('antiCheat.disabled')}</Badge>
          )}
        </div>

        {data.antiCheatEnabled ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label={t('antiCheat.events')} value={data.suspiciousEvents} />
            <Stat label={t('antiCheat.tabSwitch')} value={data.tabSwitchCount} />
            <Stat
              label={t('antiCheat.windowBlur')}
              value={data.windowBlurCount}
            />
            <Stat
              label={t('antiCheat.multiAccount')}
              value={data.multiAccountFlagged ? t('common.yes') : t('common.no')}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('antiCheat.disabledHint')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
