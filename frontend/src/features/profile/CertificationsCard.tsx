'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Award,
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCertifications,
  useAddCertification,
  useUpdateCertification,
  useDeleteCertification,
  type Certification,
} from './queries';

// Validation is a UX aid only — the backend DTO (@IsUrl, @IsDateString,
// @MinLength) is the real boundary. credentialUrl mirrors the http/https
// require_protocol contract the API enforces.
const certificationFormSchema = z.object({
  name: z.string().refine((v) => v.trim().length > 0, { message: 'required' }),
  issuer: z.string().refine((v) => v.trim().length > 0, {
    message: 'required',
  }),
  issueDate: z.string().refine((v) => v.trim().length > 0, {
    message: 'required',
  }),
  expiryDate: z.string(),
  credentialUrl: z
    .string()
    .refine((v) => v.trim() === '' || /^https?:\/\/.+/i.test(v.trim()), {
      message: 'invalid-url',
    }),
});

type CertificationFormValues = z.infer<typeof certificationFormSchema>;

const EMPTY_FORM: CertificationFormValues = {
  name: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  credentialUrl: '',
};

// EF-CAND-07 — lets a candidate add/edit/delete structured certifications,
// mirroring how experiences and links are edited on the profile screen.
export function CertificationsCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useCertifications();
  const addCertification = useAddCertification();
  const updateCertification = useUpdateCertification();
  const deleteCertification = useDeleteCertification();

  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: EMPTY_FORM,
  });

  function startEdit(cert: Certification) {
    setEditingId(cert.id);
    reset({
      name: cert.name,
      issuer: cert.issuer,
      issueDate: cert.issueDate?.slice(0, 10) ?? '',
      expiryDate: cert.expiryDate?.slice(0, 10) ?? '',
      credentialUrl: cert.credentialUrl ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    reset(EMPTY_FORM);
  }

  const onSubmit = handleSubmit((values) => {
    const input = {
      name: values.name.trim(),
      issuer: values.issuer.trim(),
      issueDate: values.issueDate,
      expiryDate: values.expiryDate.trim() || undefined,
      credentialUrl: values.credentialUrl.trim() || undefined,
    };

    if (editingId) {
      updateCertification.mutate(
        { id: editingId, input },
        {
          onSuccess: () => {
            toast(t('certifications.updated'), 'success');
            cancelEdit();
          },
          onError: () => toast(t('certifications.saveError'), 'error'),
        },
      );
    } else {
      addCertification.mutate(input, {
        onSuccess: () => reset(EMPTY_FORM),
        onError: () => toast(t('certifications.saveError'), 'error'),
      });
    }
  });

  function handleRemove(id: string) {
    if (editingId === id) cancelEdit();
    deleteCertification.mutate(id, {
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const certifications = data ?? [];
  const isSaving = addCertification.isPending || updateCertification.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5 text-primary" />
          {t('certifications.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t('certifications.description')}
        </p>

        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('certifications.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {certifications.map((cert) => (
              <li
                key={cert.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3"
              >
                <Award className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {cert.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cert.issuer}
                    {cert.issueDate ? ` · ${cert.issueDate.slice(0, 10)}` : ''}
                    {cert.expiryDate
                      ? ` → ${cert.expiryDate.slice(0, 10)}`
                      : ''}
                  </p>
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
                    >
                      <span className="truncate">
                        {t('certifications.credential')}
                      </span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => startEdit(cert)}
                  aria-label={`${t('certifications.edit')} ${cert.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(cert.id)}
                  disabled={
                    deleteCertification.isPending &&
                    deleteCertification.variables === cert.id
                  }
                  aria-label={`${t('certifications.remove')} ${cert.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-3 border-t border-border/60 pt-4"
        >
          <p className="text-sm font-medium text-foreground">
            {editingId
              ? t('certifications.editTitle')
              : t('certifications.addTitle')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cert-name">{t('certifications.name')}</Label>
              <Input
                id="cert-name"
                placeholder={t('certifications.namePlaceholder')}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {t('certifications.required')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cert-issuer">{t('certifications.issuer')}</Label>
              <Input
                id="cert-issuer"
                placeholder={t('certifications.issuerPlaceholder')}
                aria-invalid={!!errors.issuer}
                {...register('issuer')}
              />
              {errors.issuer && (
                <p className="text-xs text-destructive">
                  {t('certifications.required')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cert-issue-date">
                {t('certifications.issueDate')}
              </Label>
              <Input
                id="cert-issue-date"
                type="date"
                aria-invalid={!!errors.issueDate}
                {...register('issueDate')}
              />
              {errors.issueDate && (
                <p className="text-xs text-destructive">
                  {t('certifications.required')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cert-expiry-date">
                {t('certifications.expiryDate')}
              </Label>
              <Input
                id="cert-expiry-date"
                type="date"
                {...register('expiryDate')}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cert-url">
                {t('certifications.credentialUrl')}
              </Label>
              <Input
                id="cert-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                aria-invalid={!!errors.credentialUrl}
                {...register('credentialUrl')}
              />
              {errors.credentialUrl && (
                <p className="text-xs text-destructive">
                  {t('certifications.urlInvalid')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingId ? t('certifications.save') : t('certifications.add')}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={cancelEdit}
              >
                <X className="size-4" />
                {t('certifications.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
