'use client';

import { useState, type FormEvent } from 'react';
import { CreditCard, Loader2, X, ArrowUpDown, Gift } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Plan = 'starter' | 'growth' | 'scale' | 'enterprise';

const PLANS: { plan: Plan; label: string }[] = [
  { plan: 'starter', label: 'Starter' },
  { plan: 'growth', label: 'Growth' },
  { plan: 'scale', label: 'Scale' },
  { plan: 'enterprise', label: 'Enterprise' },
];

export default function SubscriptionPage() {
  const { t } = useLocale();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<Plan>('starter');
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [changePlan, setChangePlan] = useState<Plan>('growth');
  const [changingPlan, setChangingPlan] = useState(false);

  const [trialCode, setTrialCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

  async function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    setSubscribing(true);
    try {
      const { data, error } = await apiClient.POST('/api/v1/subscriptions', {
        body: {
          plan: selectedPlan,
          successUrl: `${window.location.origin}/subscription?status=success`,
          cancelUrl: `${window.location.origin}/subscription?status=cancelled`,
        },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      const result = data as unknown as { url?: string };
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast(t('subscription.created'), 'success');
      }
    } finally {
      setSubscribing(false);
    }
  }

  async function handleCancel() {
    if (!confirm(t('subscription.cancelConfirm'))) return;
    setCancelling(true);
    try {
      const { error } = await apiClient.POST('/api/v1/subscriptions/cancel');
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('subscription.cancelled'), 'success');
    } finally {
      setCancelling(false);
    }
  }

  async function handleChangePlan(e: FormEvent) {
    e.preventDefault();
    setChangingPlan(true);
    try {
      const { error } = await apiClient.POST('/api/v1/subscriptions/plan', {
        body: { plan: changePlan },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('subscription.planChanged'), 'success');
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleRedeemTrialCode(e: FormEvent) {
    e.preventDefault();
    if (!trialCode.trim()) return;
    setRedeemingCode(true);
    try {
      const { error } = await apiClient.POST('/api/v1/subscriptions/trial-code/redeem', {
        body: { code: trialCode.trim() },
      });
      if (error) {
        toast(t('subscription.redeemError'), 'error');
        return;
      }
      toast(t('subscription.redeemed'), 'success');
      setTrialCode('');
    } finally {
      setRedeemingCode(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('subscription.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            {t('subscription.subscribe')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubscribe(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('subscription.choosePlan')}</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PLANS.map(({ plan, label }) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      selectedPlan === plan
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={subscribing} className="gap-2 self-start">
              {subscribing && <Loader2 className="size-4 animate-spin" />}
              {t('subscription.subscribe')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="size-5" />
            {t('subscription.changePlan')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleChangePlan(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('subscription.newPlan')}</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PLANS.map(({ plan, label }) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setChangePlan(plan)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      changePlan === plan
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" variant="outline" disabled={changingPlan} className="gap-2 self-start">
              {changingPlan && <Loader2 className="size-4 animate-spin" />}
              {t('subscription.changePlan')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-5" />
            {t('subscription.trialCode')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleRedeemTrialCode(e)} className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="trial-code">{t('subscription.trialCodeLabel')}</Label>
              <Input
                id="trial-code"
                value={trialCode}
                onChange={(e) => setTrialCode(e.target.value)}
                placeholder={t('subscription.trialCodePlaceholder')}
              />
            </div>
            <Button type="submit" variant="outline" disabled={redeemingCode || !trialCode.trim()} className="gap-2">
              {redeemingCode && <Loader2 className="size-4 animate-spin" />}
              {t('subscription.redeem')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-destructive">
              {t('subscription.cancelSubscription')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('subscription.cancelDescription')}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => void handleCancel()}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            {t('subscription.cancel')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
