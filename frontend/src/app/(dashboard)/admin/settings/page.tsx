'use client';

import { useState } from 'react';
import { SlidersHorizontal, AlertCircle, Save, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSettings,
  useUpdateSetting,
  type Setting,
} from '@/features/admin/settings';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function SettingRow({ setting }: { setting: Setting }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const update = useUpdateSetting();
  const [value, setValue] = useState(setting.value);
  const dirty = value !== setting.value;

  function save() {
    update.mutate(
      { key: setting.key, value },
      {
        onSuccess: () => toast(t('adminSettings.saved'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm text-foreground">{setting.key}</p>
        {setting.description && (
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:w-72">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`${t('adminSettings.value')} ${setting.key}`}
          className="flex-1"
        />
        <Button
          size="sm"
          variant={dirty ? 'default' : 'outline'}
          className="gap-1.5"
          disabled={!dirty || update.isPending}
          onClick={save}
          aria-label={`${t('adminSettings.save')} ${setting.key}`}
        >
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// EF-ADM-02 (frontend) — admin management of reference-data settings.
export default function AdminSettingsPage() {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = useSettings();
  const settings = data ?? [];

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <SlidersHorizontal className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminSettings.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('adminSettings.subtitle')}
          </p>
        </div>
      </div>

      {isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : settings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('adminSettings.empty')}
              </p>
            ) : (
              settings.map((s) => <SettingRow key={s.key} setting={s} />)
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
