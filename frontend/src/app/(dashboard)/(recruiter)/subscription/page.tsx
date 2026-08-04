'use client';

import { useState, type FormEvent } from 'react';
import {
  CreditCard,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  Gift,
  Zap,
  Rocket,
  Star,
  Building2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Plan = 'starter' | 'growth' | 'scale' | 'enterprise';

const PLANS: { plan: Plan; label: string; icon: typeof Zap; description: string }[] = [
  { plan: 'starter', label: 'Starter', icon: Zap, description: 'For small teams' },
  { plan: 'growth', label: 'Growth', icon: Rocket, description: 'Growing companies' },
  { plan: 'scale', label: 'Scale', icon: Star, description: 'High volume hiring' },
  { plan: 'enterprise', label: 'Enterprise', icon: Building2, description: 'Custom solutions' },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

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
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('subscription.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" />
            {t('subscription.subscribe')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubscribe(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('subscription.choosePlan')}</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PLANS.map(({ plan, label, icon: Icon, description }) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-all ${
                      selectedPlan === plan
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="size-5" />
                    {label}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {description}
                    </span>
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
            <ArrowUpDown className="size-5 text-primary" />
            {t('subscription.changePlan')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleChangePlan(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('subscription.newPlan')}</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PLANS.map(({ plan, label, icon: Icon }) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setChangePlan(plan)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      changePlan === plan
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="size-4" />
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
            <Gift className="size-5 text-primary" />
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

      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-destructive/60 to-destructive/20" />
        <CardContent className="flex items-start justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {t('subscription.cancelSubscription')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('subscription.cancelDescription')}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => void handleCancel()}
            disabled={cancelling}
          >
            {cancelling && <Loader2 className="size-4 animate-spin" />}
            {t('subscription.cancel')}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
