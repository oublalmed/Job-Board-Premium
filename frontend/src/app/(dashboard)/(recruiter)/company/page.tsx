'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Building2, Plus, Trash2, Loader2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/schema';

type Company = components['schemas']['Company'];
type Recruiter = components['schemas']['Recruiter'];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function CompanyPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const isCompanyAdmin = user?.roles.includes('company_admin');

  const [company, setCompany] = useState<Company | null>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);

  const [name, setName] = useState('');
  const [ice, setIce] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [creating, setCreating] = useState(false);

  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterPosition, setRecruiterPosition] = useState('');
  const [addingRecruiter, setAddingRecruiter] = useState(false);

  useEffect(() => {
    void loadCompany();
  }, []);

  async function loadCompany() {
    setLoading(true);
    try {
      const { data, error } = await apiClient.GET('/api/v1/companies/me');
      if (error || !data) {
        setHasCompany(false);
        return;
      }
      setCompany(data as unknown as Company);
      setHasCompany(true);

      const { data: recruiterData } = await apiClient.GET('/api/v1/companies/recruiters');
      if (recruiterData) {
        setRecruiters(recruiterData as unknown as Recruiter[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{15}$/.test(ice)) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), ice };
      if (registrationNumber.trim()) body.registrationNumber = registrationNumber.trim();

      const { error } = await apiClient.POST('/api/v1/companies', {
        body: body as never,
      });
      if (error) {
        toast(t('company.createError'), 'error');
        return;
      }
      toast(t('company.created'), 'success');
      setName('');
      setIce('');
      setRegistrationNumber('');
      void loadCompany();
    } finally {
      setCreating(false);
    }
  }

  async function handleAddRecruiter(e: FormEvent) {
    e.preventDefault();
    if (!recruiterEmail.trim()) return;
    setAddingRecruiter(true);
    try {
      const body: Record<string, unknown> = { email: recruiterEmail.trim() };
      if (recruiterPosition.trim()) body.position = recruiterPosition.trim();

      const { data, error } = await apiClient.POST('/api/v1/companies/recruiters', {
        body: body as never,
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('company.recruiterAdded'), 'success');
      if (data) {
        setRecruiters((prev) => [...prev, data as Recruiter]);
      }
      setRecruiterEmail('');
      setRecruiterPosition('');
    } finally {
      setAddingRecruiter(false);
    }
  }

  async function handleRemoveRecruiter(id: string) {
    const { error } = await apiClient.DELETE('/api/v1/companies/recruiters/{id}', {
      params: { path: { id } },
    });
    if (error) {
      toast(t('common.error'), 'error');
      return;
    }
    toast(t('company.recruiterRemoved'), 'success');
    setRecruiters((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-foreground">{t('company.title')}</h1>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!hasCompany) {
    return (
      <motion.div className="flex flex-col gap-8" {...fadeUp}>
        <h1 className="text-2xl font-bold text-foreground">{t('company.title')}</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {t('company.createTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('company.createDescription')}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="company-name">{t('company.name')}</Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('company.namePlaceholder')}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="company-ice">{t('company.ice')}</Label>
                <Input
                  id="company-ice"
                  value={ice}
                  onChange={(e) => setIce(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder={t('company.icePlaceholder')}
                  required
                  maxLength={15}
                  pattern="\d{15}"
                />
                <p className="text-xs text-muted-foreground">{t('company.iceHint')}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="company-reg">{t('company.registrationNumber')}</Label>
                <Input
                  id="company-reg"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder={t('company.registrationNumberPlaceholder')}
                />
              </div>
              <Button
                type="submit"
                disabled={creating || name.trim().length < 2 || !/^\d{15}$/.test(ice)}
                className="self-start"
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('company.submitting')}
                  </>
                ) : (
                  t('company.submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('company.title')}</h1>

      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />
        <CardHeader>
          <CardTitle>{company?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('company.ice')}</p>
              <p className="text-sm font-medium text-foreground">{company?.ice ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('company.status')}</p>
              <Badge
                variant={company?.status === 'active' ? 'success' : 'warning'}
              >
                {company?.status === 'active'
                  ? t('company.verified')
                  : t('company.pending')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('company.recruiters')}</CardTitle>
          {recruiters.length > 0 && (
            <Badge variant="secondary">{recruiters.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {recruiters.map((r) => (
            <div
              key={r.id}
              className="group flex items-center justify-between rounded-xl border border-border/50 p-4 transition-all hover:border-border"
            >
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {r.user?.email ?? r.userId}
                  </p>
                  {r.position && (
                    <p className="text-xs text-muted-foreground">{r.position}</p>
                  )}
                </div>
              </div>
              {isCompanyAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                  onClick={() => void handleRemoveRecruiter(r.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {recruiters.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('company.noCompany')}</p>
          )}

          {isCompanyAdmin && (
            <form
              onSubmit={(e) => void handleAddRecruiter(e)}
              className="mt-2 flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Plus className="size-4 text-primary" />
                {t('company.addRecruiter')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('company.recruiterEmail')}</Label>
                  <Input
                    type="email"
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('company.recruiterPosition')}</Label>
                  <Input
                    value={recruiterPosition}
                    onChange={(e) => setRecruiterPosition(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={addingRecruiter || !recruiterEmail.trim()}
                className="gap-2 self-start"
              >
                {addingRecruiter ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t('company.addRecruiter')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
