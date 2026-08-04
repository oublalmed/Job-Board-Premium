'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, FileText, ExternalLink } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface VerificationDetail {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  candidateName: string | null;
  ocrExtractedText: string | null;
  matchedSchool: string | null;
  confidence: number | string | null;
  documentUrl: string;
  documentName: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export default function AdminSchoolVerificationDetailPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<'verify' | 'reject' | null>(null);

  async function loadDetail() {
    setLoading(true);
    setError(false);
    try {
      const { data, error: apiError } = await apiClient.GET(
        '/api/v1/admin/school-verifications/{id}',
        { params: { path: { id } } },
      );
      if (apiError || !data) {
        setError(true);
        return;
      }
      setDetail(data as unknown as VerificationDetail);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    void loadDetail();
  }, [id]);

  async function handleDecision(decision: 'verify' | 'reject') {
    setSubmitting(decision);
    try {
      const body = { note: note.trim() || undefined };
      const { error: apiError } =
        decision === 'verify'
          ? await apiClient.PATCH('/api/v1/admin/school-verifications/{id}/verify', {
              params: { path: { id } },
              body,
            })
          : await apiClient.PATCH('/api/v1/admin/school-verifications/{id}/reject', {
              params: { path: { id } },
              body,
            });
      if (apiError) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(
        decision === 'verify'
          ? t('admin.schoolVerifications.verified')
          : t('admin.schoolVerifications.rejected'),
        'success',
      );
      router.push('/admin/school-verifications');
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">
          {t('admin.schoolVerifications.notFound')}
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const isPending = detail.status === 'pending';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">{t('admin.schoolVerifications.noteLabel')}</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="gap-2"
                onClick={() => void handleDecision('verify')}
                disabled={submitting !== null}
              >
                <Check className="size-4" />
                {t('admin.schoolVerifications.approve')}
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => void handleDecision('reject')}
                disabled={submitting !== null}
              >
                <X className="size-4" />
                {t('admin.schoolVerifications.reject')}
              </Button>
            </div>
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
    </div>
  );
}
