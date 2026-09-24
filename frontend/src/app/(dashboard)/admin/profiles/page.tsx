'use client';

import { useState } from 'react';
import { ShieldAlert, AlertCircle, Loader2, Ban, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useModeratedProfiles,
  useModerateProfile,
  type ProfileModerationStatus,
} from '@/features/admin/profiles';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const FILTERS: Array<ProfileModerationStatus | 'all'> = ['all', 'active', 'suspended'];

// EF-ADM-01 (frontend) — admin moderation queue for candidate profiles.
export default function AdminProfilesPage() {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const [filter, setFilter] = useState<ProfileModerationStatus | 'all'>('all');
  const { data, isLoading, isError, refetch } = useModeratedProfiles(filter);
  const moderate = useModerateProfile();
  const profiles = data?.items ?? [];

  function act(id: string, status: ProfileModerationStatus) {
    moderate.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast(
            status === 'suspended'
              ? t('adminProfiles.suspended')
              : t('adminProfiles.reinstated'),
            'success',
          ),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <ShieldAlert className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminProfiles.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('adminProfiles.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              filter === f
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`adminProfiles.filter_${f}`)}
          </button>
        ))}
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
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('adminProfiles.empty')}
              </p>
            ) : (
              <ul className="flex flex-col">
                {profiles.map((p) => {
                  const pending = moderate.isPending && moderate.variables?.id === p.id;
                  const suspended = p.moderationStatus === 'suspended';
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}
                        </p>
                        {p.headline && (
                          <p className="truncate text-xs text-muted-foreground">
                            {p.headline}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={suspended ? 'destructive' : 'success'}>
                          {t(`adminProfiles.status_${p.moderationStatus}`)}
                        </Badge>
                        {suspended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={pending}
                            onClick={() => act(p.id, 'active')}
                          >
                            {pending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5" />
                            )}
                            {t('adminProfiles.reinstate')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            disabled={pending}
                            onClick={() => act(p.id, 'suspended')}
                          >
                            {pending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Ban className="size-3.5" />
                            )}
                            {t('adminProfiles.suspend')}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
