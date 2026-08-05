'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  User,
  MapPin,
  Upload,
  Trash2,
  Save,
  FileText,
  Briefcase,
  Building2,
  ShieldCheck,
  Clock,
  ShieldX,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  profileSchema,
  EMPTY_PROFILE_FORM,
  type ProfileFormValues,
} from '@/features/profile/schema';
import {
  useCandidateCv,
  useCandidateProfile,
  useDeleteCv,
  useRecruiterSelf,
  useSchoolVerification,
  useUpdateProfile,
  useUploadCv,
  useUploadDiploma,
} from '@/features/profile/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const isCandidate = user.roles.includes('candidate');
  const isRecruiter = user.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );

  if (isCandidate) return <CandidateProfile />;
  if (isRecruiter) return <RecruiterProfile />;
  return null;
}

function RecruiterProfile() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data, isLoading } = useRecruiterSelf(user?.userId);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="relative flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="-mt-16 flex size-24 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-primary/20 to-primary/5">
            <User className="size-12 text-primary" />
          </div>
          <div className="flex flex-1 flex-col gap-4 text-center sm:text-start">
            <div>
              <p className="text-lg font-semibold text-foreground">{user.email}</p>
              {data?.recruiter?.position && (
                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start">
                  <Briefcase className="size-3.5" />
                  {data.recruiter.position}
                </p>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            {data?.companyName && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                <Building2 className="size-4" />
                {data.companyName}
              </div>
            )}

            <Link href="/company" className="self-center sm:self-start">
              <Button variant="outline" size="sm">
                {t('company.title')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CompletionRing({ value }: { value: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${Math.round(value)}%`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-sm font-bold">
        {Math.round(value)}%
      </text>
    </svg>
  );
}

function CandidateProfile() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();
  const cvInputRef = useRef<HTMLInputElement>(null);
  const diplomaInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useCandidateProfile();
  const cvQuery = useCandidateCv();
  const verificationQuery = useSchoolVerification();

  const updateProfile = useUpdateProfile();
  const deleteCv = useDeleteCv();
  const uploadCv = useUploadCv();
  const uploadDiploma = useUploadDiploma();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: EMPTY_PROFILE_FORM,
  });

  // Hydrate the form once the profile query resolves. reset() is the
  // canonical RHF way to seed async defaults without losing dirty state
  // tracking.
  useEffect(() => {
    const p = profileQuery.data?.profile;
    if (!p) return;
    form.reset({
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      headline: p.headline ?? '',
      bio: p.bio ?? '',
      location: p.location ?? '',
      availability: p.availability ?? '',
      mobility: p.mobility ?? '',
      school: p.school ?? '',
      visibility: p.visibility ?? 'hidden',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data]);

  const completeness = profileQuery.data?.completeness.completeness ?? 0;
  const schoolVerified = profileQuery.data?.profile.schoolVerified ?? false;
  const cv = cvQuery.data ?? null;
  const verification = verificationQuery.data ?? null;
  const preview = form.watch();

  const onSubmit = form.handleSubmit((values) => {
    updateProfile.mutate(values, {
      onSuccess: () => toast(t('profile.saved'), 'success'),
      onError: () => toast(t('profile.saveError'), 'error'),
    });
  });

  function handleCvSelected(file: File) {
    uploadCv.mutate(file, {
      onSuccess: () => toast(t('profile.cvUploaded'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleDeleteCv() {
    deleteCv.mutate(undefined, {
      onSuccess: () => toast(t('profile.cvDeleted'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleDiplomaSelected(file: File) {
    uploadDiploma.mutate(file, {
      onSuccess: () => toast(t('profile.diplomaUploaded'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  if (!user) return null;

  if (profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CompletionRing value={completeness} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('profile.completeness')}: {Math.round(completeness)}%
            </p>
          </div>
        </div>
        <Button onClick={() => void onSubmit()} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {updateProfile.isPending ? t('profile.saving') : t('profile.save')}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-6 lg:grid-cols-3">
          <Card className="h-fit overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
            <CardContent className="relative flex flex-col items-center gap-4 p-6">
              <div className="-mt-14 flex size-24 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-primary/20 to-primary/5">
                <User className="size-12 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {preview.firstName || preview.lastName
                    ? `${preview.firstName} ${preview.lastName}`.trim()
                    : user.email}
                </p>
                {preview.headline && (
                  <p className="mt-1 text-sm text-muted-foreground">{preview.headline}</p>
                )}
                {preview.location && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {preview.location}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('profile.personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.firstName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.lastName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="headline"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('profile.headline')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('profile.bio')}</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder={t('profile.bioPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.location')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('profile.locationPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <Label htmlFor="profile-email">{t('profile.email')}</Label>
                  <Input id="profile-email" value={user.email} disabled />
                </FormItem>
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.availability')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('profile.availabilityPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.mobility')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('profile.mobilityPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {t('profile.school')}
                        {schoolVerified && (
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck className="size-3" />
                            {t('profile.schoolVerifiedBadge')}
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t('profile.schoolPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.visibility')}</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          <option value="public">{t('profile.visibilityPublic')}</option>
                          <option value="recruiters_only">
                            {t('profile.visibilityRecruitersOnly')}
                          </option>
                          <option value="hidden">{t('profile.visibilityHidden')}</option>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.cv')}</CardTitle>
        </CardHeader>
        <CardContent>
          {cv ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <FileText className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{cv.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(cv.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleDeleteCv}
                disabled={deleteCv.isPending}
              >
                {deleteCv.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {t('profile.deleteCv')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t('profile.noCv')}</p>
              <div>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCvSelected(file);
                  }}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => cvInputRef.current?.click()}
                  disabled={uploadCv.isPending}
                >
                  {uploadCv.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploadCv.isPending ? t('common.loading') : t('profile.uploadCv')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.schoolVerification.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {verification && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              {verification.status === 'verified' && (
                <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
              )}
              {verification.status === 'pending' && (
                <Clock className="size-5 shrink-0 text-amber-600" />
              )}
              {verification.status === 'rejected' && (
                <ShieldX className="size-5 shrink-0 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`profile.schoolVerification.status.${verification.status}`)}
                  {verification.matchedSchool ? ` — ${verification.matchedSchool}` : ''}
                </p>
                {verification.status === 'rejected' && verification.reviewNote && (
                  <p className="mt-1 text-xs text-muted-foreground">{verification.reviewNote}</p>
                )}
              </div>
            </div>
          )}

          {(!verification || verification.status === 'rejected') && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t('profile.schoolVerification.hint')}
              </p>
              <div>
                <input
                  ref={diplomaInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDiplomaSelected(file);
                  }}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => diplomaInputRef.current?.click()}
                  disabled={uploadDiploma.isPending}
                >
                  {uploadDiploma.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploadDiploma.isPending
                    ? t('common.loading')
                    : t('profile.schoolVerification.upload')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
