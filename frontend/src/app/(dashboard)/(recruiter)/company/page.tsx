'use client';

import { Building2, Plus, Trash2, Loader2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AntiCheatToggle } from '@/features/anti-cheat/AntiCheatToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  addRecruiterSchema,
  createCompanySchema,
  EMPTY_COMPANY,
  EMPTY_RECRUITER,
  type AddRecruiterValues,
  type CreateCompanyValues,
} from '@/features/company/schema';
import {
  useCompany,
  useCreateCompany,
  useRecruiters,
  useRemoveRecruiter,
  useInviteRecruiter,
  useRecruiterInvitations,
  useRevokeInvitation,
} from '@/features/company/queries';

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

  const companyQuery = useCompany();
  const company = companyQuery.data ?? null;
  const hasCompany = company !== null;

  const recruitersQuery = useRecruiters(hasCompany);
  const recruiters = recruitersQuery.data ?? [];
  const invitationsQuery = useRecruiterInvitations(
    hasCompany && !!isCompanyAdmin,
  );
  const pendingInvitations = invitationsQuery.data ?? [];

  const createCompany = useCreateCompany();
  const removeRecruiter = useRemoveRecruiter();
  const inviteRecruiter = useInviteRecruiter();
  const revokeInvitation = useRevokeInvitation();

  const createForm = useForm<CreateCompanyValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: EMPTY_COMPANY,
  });
  const recruiterForm = useForm<AddRecruiterValues>({
    resolver: zodResolver(addRecruiterSchema),
    defaultValues: EMPTY_RECRUITER,
  });

  const onCreate = createForm.handleSubmit((values) => {
    createCompany.mutate(values, {
      onSuccess: () => {
        toast(t('company.created'), 'success');
        createForm.reset(EMPTY_COMPANY);
      },
      onError: () => toast(t('company.createError'), 'error'),
    });
  });

  const onInviteRecruiter = recruiterForm.handleSubmit((values) => {
    inviteRecruiter.mutate(values, {
      onSuccess: (res) => {
        toast(
          res.status === 'attached'
            ? t('company.recruiterAdded')
            : t('company.invitationSent'),
          'success',
        );
        recruiterForm.reset(EMPTY_RECRUITER);
      },
      // The backend message is user-facing (seat limit, duplicate…) — surface it.
      onError: (e) =>
        toast((e as Error).message || t('common.error'), 'error'),
    });
  });

  const removingId = removeRecruiter.isPending ? removeRecruiter.variables : null;

  function handleRemoveRecruiter(id: string) {
    removeRecruiter.mutate(id, {
      onSuccess: () => toast(t('company.recruiterRemoved'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const revokingId = revokeInvitation.isPending
    ? revokeInvitation.variables
    : null;

  function handleRevokeInvitation(id: string) {
    revokeInvitation.mutate(id, {
      onSuccess: () => toast(t('company.invitationRevoked'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  if (companyQuery.isLoading) {
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
            <Form {...createForm}>
              <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('company.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('company.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="ice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('company.ice')}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={15}
                          placeholder={t('company.icePlaceholder')}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 15))
                          }
                        />
                      </FormControl>
                      <FormDescription>{t('company.iceHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('company.registrationNumber')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('company.registrationNumberPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createCompany.isPending} className="gap-2 self-start">
                  {createCompany.isPending && <Loader2 className="size-4 animate-spin" />}
                  {createCompany.isPending ? t('company.submitting') : t('company.submit')}
                </Button>
              </form>
            </Form>
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
              <Badge variant={company?.status === 'active' ? 'success' : 'warning'}>
                {company?.status === 'active' ? t('company.verified') : t('company.pending')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* §2 — anti-cheat toggle (only shown with the ANTI_CHEAT feature). */}
      <AntiCheatToggle />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('company.recruiters')}</CardTitle>
          {recruiters.length > 0 && <Badge variant="secondary">{recruiters.length}</Badge>}
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
                    {r.email}
                  </p>
                  {r.position && <p className="text-xs text-muted-foreground">{r.position}</p>}
                </div>
              </div>
              {isCompanyAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  className="text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={() => handleRemoveRecruiter(r.id)}
                  disabled={removingId === r.id}
                >
                  {removingId === r.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              )}
            </div>
          ))}

          {recruiters.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('company.noRecruiters')}
            </p>
          )}

          {/* Pending invitations (not yet accepted) */}
          {isCompanyAdmin && pendingInvitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('company.pendingInvitations')}
              </p>
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{inv.email}</p>
                      <p className="text-xs text-warning">{t('company.invitePending')}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    disabled={revokingId === inv.id}
                  >
                    {revokingId === inv.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isCompanyAdmin && (
            <Form {...recruiterForm}>
              <form
                onSubmit={(e) => void onInviteRecruiter(e)}
                className="mt-2 flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Plus className="size-4 text-primary" />
                    {t('company.inviteRecruiter')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('company.inviteHint')}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={recruiterForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('company.recruiterEmail')}</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={recruiterForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('company.recruiterPosition')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={inviteRecruiter.isPending}
                  className="gap-2 self-start"
                >
                  {inviteRecruiter.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {t('company.inviteRecruiter')}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
