'use client';

import { useState } from 'react';
import { UserPlus, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useAssignableCompanies,
  type SubscriptionPlan,
} from '@/features/admin/subscriptions';
import {
  useCreateRecruiter,
  type CreatedRecruiter,
} from '@/features/admin/recruiters';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const PLANS: SubscriptionPlan[] = ['starter', 'growth', 'scale', 'enterprise'];

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function AdminRecruitersPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data: companies } = useAssignableCompanies();
  const create = useCreateRecruiter();

  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [companyMode, setCompanyMode] = useState<'new' | 'existing'>('new');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [assignPack, setAssignPack] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>('starter');
  const [quota, setQuota] = useState('');
  const [created, setCreated] = useState<CreatedRecruiter | null>(null);

  const isEnterprise = plan === 'enterprise';
  const quotaRequired = assignPack && isEnterprise;

  const companyValid =
    companyMode === 'new' ? companyName.trim().length >= 2 : !!companyId;
  const canSubmit =
    /\S+@\S+\.\S+/.test(email) &&
    companyValid &&
    (!quotaRequired || quota.trim() !== '') &&
    !create.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    let contactQuota: number | undefined;
    if (assignPack && quota.trim() !== '') {
      const n = Number(quota);
      if (!Number.isFinite(n) || n < 0) {
        toast(t('common.error'), 'error');
        return;
      }
      contactQuota = Math.floor(n);
    }

    create.mutate(
      {
        email: email.trim(),
        position: position.trim() || undefined,
        companyId: companyMode === 'existing' ? companyId : undefined,
        companyName: companyMode === 'new' ? companyName.trim() : undefined,
        plan: assignPack ? plan : undefined,
        contactQuota: assignPack ? contactQuota : undefined,
      },
      {
        onSuccess: (res) => {
          setCreated(res);
          toast(t('adminRecruiters.created'), 'success');
          // Reset the form for the next entry.
          setEmail('');
          setPosition('');
          setCompanyName('');
          setCompanyId('');
          setQuota('');
          setAssignPack(false);
        },
        onError: (err) =>
          toast(
            err instanceof Error ? err.message : t('adminRecruiters.error'),
            'error',
          ),
      },
    );
  }

  return (
    <motion.div className="flex max-w-2xl flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <UserPlus className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('adminRecruiters.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('adminRecruiters.subtitle')}
          </p>
        </div>
      </div>

      {created && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {t('adminRecruiters.successTitle')}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {t('adminRecruiters.successBody', {
                  email: created.email,
                  company: created.companyName,
                })}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3.5" />
                {t('adminRecruiters.successMail')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('adminRecruiters.email')} *
              </span>
              <input
                type="email"
                required
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('adminRecruiters.emailPlaceholder')}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('adminRecruiters.position')}
              </span>
              <input
                type="text"
                className={fieldClass}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={t('adminRecruiters.positionPlaceholder')}
              />
            </label>

            {/* Company: new or existing */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t('adminRecruiters.company')} *
              </span>
              <div className="flex gap-2">
                {(['new', 'existing'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCompanyMode(m)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      companyMode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {m === 'new'
                      ? t('adminRecruiters.companyNew')
                      : t('adminRecruiters.companyExisting')}
                  </button>
                ))}
              </div>
              {companyMode === 'new' ? (
                <input
                  type="text"
                  className={fieldClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t('adminRecruiters.companyNamePlaceholder')}
                />
              ) : (
                <select
                  className={fieldClass}
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">
                    {t('adminRecruiters.companySelect')}
                  </option>
                  {(companies ?? []).map((c) => (
                    <option key={c.companyId} value={c.companyId}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Optional pack assignment */}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={assignPack}
                onChange={(e) => setAssignPack(e.target.checked)}
              />
              {t('adminRecruiters.assignPack')}
            </label>

            {assignPack && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('adminRecruiters.plan')}
                  </span>
                  <select
                    className={fieldClass}
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {t(`adminSubscriptions.plan_${p}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('adminRecruiters.quota')}
                    {quotaRequired ? ' *' : ''}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className={fieldClass}
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                    placeholder={
                      quotaRequired
                        ? t('adminRecruiters.quotaRequiredPlaceholder')
                        : t('adminRecruiters.quotaDefault')
                    }
                  />
                </label>
              </div>
            )}

            <div>
              <Button type="submit" className="gap-2" disabled={!canSubmit}>
                {create.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {t('adminRecruiters.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
