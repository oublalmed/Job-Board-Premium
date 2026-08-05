'use client';

import { useState } from 'react';
import { Users, Copy, Check, UserPlus, TrendingUp } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useReferral } from './queries';

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ReferralCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useReferral();
  const [copied, setCopied] = useState(false);

  const link =
    data?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/register?ref=${data.code}`
      : '';

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast(t('referral.copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('common.error'), 'error');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          {t('referral.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('referral.subtitle')}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-xs">{t('referral.yourLink')}</Label>
              <div className="flex gap-2">
                <Input value={link} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void handleCopy()}
                  aria-label={t('referral.copyLink')}
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={UserPlus} label={t('referral.signups')} value={data?.signups ?? 0} />
              <Stat
                icon={TrendingUp}
                label={t('referral.conversions')}
                value={data?.conversions ?? 0}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
