'use client';

import { useState } from 'react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PLANS, trialCodeSchema, type Plan, type TrialCodeValues } from '@/features/subscription/schema';
import {
  useCancelSubscription,
  useChangePlan,
  useRedeemTrialCode,
  useSubscribe,
} from '@/features/subscription/queries';

const PLAN_META: Record<Plan, { label: string; icon: typeof Zap; description: string }> = {
  starter: { label: 'Starter', icon: Zap, description: 'For small teams' },
  growth: { label: 'Growth', icon: Rocket, description: 'Growing companies' },
  scale: { label: 'Scale', icon: Star, description: 'High volume hiring' },
  enterprise: { label: 'Enterprise', icon: Building2, description: 'Custom solutions' },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function SubscriptionPage() {
  const { t } = useLocale();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<Plan>('starter');
  const [changePlanValue, setChangePlanValue] = useState<Plan>('growth');

  const subscribe = useSubscribe();
  const changePlan = useChangePlan();
  const cancel = useCancelSubscription();
  const redeem = useRedeemTrialCode();

  const trialForm = useForm<TrialCodeValues>({
    resolver: zodResolver(trialCodeSchema),
    defaultValues: { code: '' },
  });

  function handleSubscribe() {
    subscribe.mutate(selectedPlan, {
      onSuccess: (url) => {
        if (url) {
          window.location.href = url;
        } else {
          toast(t('subscription.created'), 'success');
        }
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleChangePlan() {
    changePlan.mutate(changePlanValue, {
      onSuccess: () => toast(t('subscription.planChanged'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleCancel() {
    if (!confirm(t('subscription.cancelConfirm'))) return;
    cancel.mutate(undefined, {
      onSuccess: () => toast(t('subscription.cancelled'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const onRedeem = trialForm.handleSubmit((values) => {
    redeem.mutate(values, {
      onSuccess: () => {
        toast(t('subscription.redeemed'), 'success');
        trialForm.reset({ code: '' });
      },
      onError: () => toast(t('subscription.redeemError'), 'error'),
    });
  });

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
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('subscription.choosePlan')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PLANS.map((plan) => {
                const meta = PLAN_META[plan];
                const Icon = meta.icon;
                const active = selectedPlan === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedPlan(plan)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="size-5" />
                    {meta.label}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Button onClick={handleSubscribe} disabled={subscribe.isPending} className="gap-2 self-start">
            {subscribe.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('subscription.subscribe')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="size-5 text-primary" />
            {t('subscription.changePlan')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('subscription.newPlan')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PLANS.map((plan) => {
                const meta = PLAN_META[plan];
                const Icon = meta.icon;
                const active = changePlanValue === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChangePlanValue(plan)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="size-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Button
            variant="outline"
            onClick={handleChangePlan}
            disabled={changePlan.isPending}
            className="gap-2 self-start"
          >
            {changePlan.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('subscription.changePlan')}
          </Button>
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
          <Form {...trialForm}>
            <form onSubmit={(e) => void onRedeem(e)} className="flex items-start gap-3">
              <FormField
                control={trialForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t('subscription.trialCodeLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('subscription.trialCodePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={redeem.isPending}
                className="mt-[26px] gap-2"
              >
                {redeem.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('subscription.redeem')}
              </Button>
            </form>
          </Form>
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
            onClick={handleCancel}
            disabled={cancel.isPending}
          >
            {cancel.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('subscription.cancel')}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
