'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { reviewNoteSchema, type ReviewNoteValues } from '@/features/admin/schema';
import {
  useReviewVerification,
  useVerificationDetail,
} from '@/features/admin/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function AdminSchoolVerificationDetailPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: detail, isLoading, isError } = useVerificationDetail(id);
  const review = useReviewVerification();

  const form = useForm<ReviewNoteValues>({
    resolver: zodResolver(reviewNoteSchema),
    defaultValues: { note: '' },
  });

  function submit(decision: 'verify' | 'reject') {
    return form.handleSubmit((values) => {
      review.mutate(
        { id, decision, note: values.note },
        {
          onSuccess: () => {
            toast(
              decision === 'verify'
                ? t('admin.schoolVerifications.verified')
                : t('admin.schoolVerifications.rejected'),
              'success',
            );
            router.push('/admin/school-verifications');
          },
          onError: () => toast(t('common.error'), 'error'),
        },
      );
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">
          {t('admin.schoolVerifications.notFound')}
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="me-2 size-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const isPending = detail.status === 'pending';
  const submitting = review.isPending ? review.variables?.decision : null;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label={t('common.back')}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          {t('admin.schoolVerifications.detailTitle')}
        </h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {detail.candidateName ?? t('admin.schoolVerifications.unnamedCandidate')}
            </h2>
            <Badge
              variant={
                detail.status === 'verified'
                  ? 'success'
                  : detail.status === 'rejected'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {t(`admin.schoolVerifications.status.${detail.status}`)}
            </Badge>
          </div>

          <a
            href={detail.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground hover:border-primary/40"
          >
            <FileText className="size-4 text-primary" />
            {detail.documentName}
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.schoolVerifications.matchTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {detail.matchedSchool ? (
              <Badge variant="secondary" className="w-fit">
                {detail.matchedSchool}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.schoolVerifications.noMatch')}
              </p>
            )}
            {detail.confidence != null && (
              <p className="text-xs text-muted-foreground">
                {t('admin.schoolVerifications.confidence', {
                  value: String(Math.round(Number(detail.confidence))),
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.schoolVerifications.ocrTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {detail.ocrExtractedText ?? '—'}
            </pre>
          </CardContent>
        </Card>
      </div>

      {isPending ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.schoolVerifications.decisionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.schoolVerifications.noteLabel')}</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-3">
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => void submit('verify')()}
                    disabled={review.isPending}
                  >
                    {submitting === 'verify' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {t('admin.schoolVerifications.approve')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => void submit('reject')()}
                    disabled={review.isPending}
                  >
                    {submitting === 'reject' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                    {t('admin.schoolVerifications.reject')}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        detail.reviewNote && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('admin.schoolVerifications.noteLabel')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{detail.reviewNote}</p>
            </CardContent>
          </Card>
        )
      )}
    </motion.div>
  );
}
