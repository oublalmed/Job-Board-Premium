'use client';

import { ShieldCheck } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { useFeature } from '@/features/entitlements/queries';
import { useAntiCheatSetting, useSetAntiCheatSetting } from './queries';

// §2.1 — the recruiter turns the anti-cheat option on/off. Rendered only when
// the pack includes ANTI_CHEAT; the PATCH is also gated at the API.
export function AntiCheatToggle() {
  const { t } = useLocale();
  const { toast } = useToast();
  const hasFeature = useFeature('anti_cheat');
  const { data } = useAntiCheatSetting(hasFeature);
  const setSetting = useSetAntiCheatSetting();

  if (!hasFeature) return null;

  const enabled = data?.enabled ?? true;

  function toggle() {
    setSetting.mutate(!enabled, {
      onSuccess: () => toast(t('antiCheat.settingSaved'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t('antiCheat.settingTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('antiCheat.settingHint')}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('antiCheat.settingTitle')}
          disabled={setSetting.isPending}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}
