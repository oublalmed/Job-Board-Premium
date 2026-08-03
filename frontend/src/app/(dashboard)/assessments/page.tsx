'use client';

import { useState, type FormEvent } from 'react';
import {
  Play,
  RotateCcw,
  AlertTriangle,
  MessageCircle,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AssessmentsPage() {
  const { t } = useLocale();
  const { toast } = useToast();

  const [testId, setTestId] = useState('');
  const [starting, setStarting] = useState(false);

  const [resumeAssessmentId, setResumeAssessmentId] = useState('');
  const [resumeToken, setResumeToken] = useState('');
  const [resuming, setResuming] = useState(false);

  const [incidentId, setIncidentId] = useState('');
  const [reportingIncident, setReportingIncident] = useState(false);

  const [feedbackId, setFeedbackId] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!testId.trim()) return;
    setStarting(true);
    try {
      const { error } = await apiClient.POST('/api/v1/assessments/start', {
        body: { testId: testId.trim() },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('assessments.started'), 'success');
      setTestId('');
    } finally {
      setStarting(false);
    }
  }

  async function handleResume(e: FormEvent) {
    e.preventDefault();
    if (!resumeAssessmentId.trim() || !resumeToken.trim()) return;
    setResuming(true);
    try {
      const { error } = await apiClient.POST('/api/v1/assessments/resume', {
        body: {
          assessmentId: resumeAssessmentId.trim(),
          resumeToken: resumeToken.trim(),
        },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('assessments.resumed'), 'success');
      setResumeAssessmentId('');
      setResumeToken('');
    } finally {
      setResuming(false);
    }
  }

  async function handleReportIncident(e: FormEvent) {
    e.preventDefault();
    if (!incidentId.trim()) return;
    setReportingIncident(true);
    try {
      const { error } = await apiClient.POST('/api/v1/assessments/{id}/incident', {
        params: { path: { id: incidentId.trim() } },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('assessments.incidentReported'), 'success');
      setIncidentId('');
    } finally {
      setReportingIncident(false);
    }
  }

  async function handleGetFeedback(e: FormEvent) {
    e.preventDefault();
    if (!feedbackId.trim()) return;
    setLoadingFeedback(true);
    setFeedback(null);
    try {
      const { data, error } = await apiClient.GET('/api/v1/assessments/{id}/feedback', {
        params: { path: { id: feedbackId.trim() } },
      });
      if (error) {
        toast(t('assessments.feedbackError'), 'error');
        return;
      }
      setFeedback((data as Record<string, unknown>) ?? {});
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('assessments.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="size-5" />
            {t('assessments.start')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleStart(e)} className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="test-id">{t('assessments.testId')}</Label>
              <Input
                id="test-id"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder={t('assessments.testIdPlaceholder')}
              />
            </div>
            <Button type="submit" disabled={starting || !testId.trim()} className="gap-2">
              {starting && <Loader2 className="size-4 animate-spin" />}
              {t('assessments.startButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="size-5" />
            {t('assessments.resume')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleResume(e)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="resume-assessment-id">{t('assessments.assessmentId')}</Label>
                <Input
                  id="resume-assessment-id"
                  value={resumeAssessmentId}
                  onChange={(e) => setResumeAssessmentId(e.target.value)}
                  placeholder={t('assessments.assessmentIdPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="resume-token">{t('assessments.resumeToken')}</Label>
                <Input
                  id="resume-token"
                  value={resumeToken}
                  onChange={(e) => setResumeToken(e.target.value)}
                  placeholder={t('assessments.resumeTokenPlaceholder')}
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={resuming || !resumeAssessmentId.trim() || !resumeToken.trim()}
              className="gap-2 self-start"
            >
              {resuming && <Loader2 className="size-4 animate-spin" />}
              {t('assessments.resumeButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            {t('assessments.reportIncident')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleReportIncident(e)} className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="incident-id">{t('assessments.assessmentId')}</Label>
              <Input
                id="incident-id"
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
                placeholder={t('assessments.assessmentIdPlaceholder')}
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={reportingIncident || !incidentId.trim()}
              className="gap-2"
            >
              {reportingIncident && <Loader2 className="size-4 animate-spin" />}
              {t('assessments.reportButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            {t('assessments.feedback')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleGetFeedback(e)} className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="feedback-id">{t('assessments.assessmentId')}</Label>
                <Input
                  id="feedback-id"
                  value={feedbackId}
                  onChange={(e) => setFeedbackId(e.target.value)}
                  placeholder={t('assessments.assessmentIdPlaceholder')}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={loadingFeedback || !feedbackId.trim()}
                className="gap-2"
              >
                {loadingFeedback && <Loader2 className="size-4 animate-spin" />}
                {t('assessments.viewFeedback')}
              </Button>
            </div>

            {feedback && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 pb-3">
                  <ClipboardList className="size-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {t('assessments.feedbackResults')}
                  </span>
                </div>
                <pre className="overflow-x-auto text-sm text-muted-foreground">
                  {JSON.stringify(feedback, null, 2)}
                </pre>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
