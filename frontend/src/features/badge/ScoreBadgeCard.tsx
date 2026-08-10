'use client';

import { useState } from 'react';
import { Award, Check, Copy, Share2, Loader2, Lock } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDisableBadge,
  useEnableBadge,
  useScoreBadge,
} from './queries';
import { ScoreShowcase } from './ScoreShowcase';

export function ScoreBadgeCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useScoreBadge();
  const enableBadge = useEnableBadge();
  const disableBadge = useDisableBadge();

  const [displayName, setDisplayName] = useState('');
  const [copied, setCopied] = useState(false);

  const shareUrl =
    data?.token && typeof window !== 'undefined'
      ? `${window.location.origin}/badge/${data.token}`
      : '';

  function handleEnable() {
    enableBadge.mutate(displayName, {
      onSuccess: () => toast(t('badge.enabled'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleDisable() {
    disableBadge.mutate(undefined, {
      onSuccess: () => toast(t('badge.disabled'), 'info'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast(t('badge.copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('common.error'), 'error');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5 text-primary" />
          {t('badge.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('badge.subtitle')}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !data?.hasScore ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            {t('badge.needScore')}
          </div>
        ) : data.enabled && data.badge ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-border bg-muted/20 p-5">
              <ScoreShowcase badge={data.badge} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">{t('badge.publicLink')}</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => void handleCopy()} aria-label={t('badge.copyLink')}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="gap-2">
                  <Share2 className="size-4" />
                  {t('badge.shareLinkedin')}
                </Button>
              </a>
              <Button
                variant="ghost"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={handleDisable}
                disabled={disableBadge.isPending}
              >
                {disableBadge.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('badge.disable')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="badge-display-name">{t('badge.displayName')}</Label>
              <Input
                id="badge-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('badge.displayNamePlaceholder')}
                maxLength={80}
              />
            </div>
            <Button className="gap-2 self-start" onClick={handleEnable} disabled={enableBadge.isPending}>
              {enableBadge.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Award className="size-4" />
              )}
              {enableBadge.isPending ? t('badge.enabling') : t('badge.enable')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
