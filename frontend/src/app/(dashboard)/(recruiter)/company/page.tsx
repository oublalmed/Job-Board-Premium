'use client';

import { Building2, Plus, Trash2, Loader2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  useAddRecruiter,
  useCompany,
  useCreateCompany,
  useRecruiters,
  useRemoveRecruiter,
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

  const createCompany = useCreateCompany();
  const addRecruiter = useAddRecruiter();
  const removeRecruiter = useRemoveRecruiter();

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

  const onAddRecruiter = recruiterForm.handleSubmit((values) => {
    addRecruiter.mutate(values, {
      onSuccess: () => {
        toast(t('company.recruiterAdded'), 'success');
        recruiterForm.reset(EMPTY_RECRUITER);
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  });

  const removingId = removeRecruiter.isPending ? removeRecruiter.variables : null;

  function handleRemoveRecruiter(id: string) {
    removeRecruiter.mutate(id, {
      onSuccess: () => toast(t('company.recruiterRemoved'), 'success'),
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
                    {r.user?.email ?? r.userId}
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
            <p className="text-sm text-muted-foreground">{t('company.noCompany')}</p>
          )}

          {isCompanyAdmin && (
            <Form {...recruiterForm}>
              <form
                onSubmit={(e) => void onAddRecruiter(e)}
                className="mt-2 flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
              >
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Plus className="size-4 text-primary" />
                  {t('company.addRecruiter')}
                </p>
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
                  disabled={addRecruiter.isPending}
                  className="gap-2 self-start"
                >
                  {addRecruiter.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {t('company.addRecruiter')}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
