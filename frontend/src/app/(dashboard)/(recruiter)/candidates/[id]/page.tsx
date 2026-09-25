'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Star,
  UserPlus,
  MessageSquare,
  Loader2,
  TrendingUp,
  Lock,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Link2,
  Download,
  FileText,
  ExternalLink,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAddToShortlist,
  useCandidateDetail,
} from '@/features/candidates/queries';
import { CandidateScoreBadge } from '@/features/candidates/CandidateScoreBadge';
import { MessagePopup } from '@/features/messages/MessagePopup';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

// "2022-05-01" -> "mai 2022" in the active locale; falsy -> null.
function formatMonth(date: string | null, locale: string): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short' });
}

function formatRange(
  start: string | null,
  end: string | null,
  locale: string,
  present: string,
): string {
  const s = formatMonth(start, locale);
  const e = end ? formatMonth(end, locale) : present;
  if (!s) return e === present ? '' : (e ?? '');
  return `${s} — ${e}`;
}

// Human-readable file size for the CV download button.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CandidateDetailPage() {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: candidate, isLoading, isError } = useCandidateDetail(id);
  const addToShortlist = useAddToShortlist();
  const [messageOpen, setMessageOpen] = useState(false);

  function handleAdd() {
    if (!candidate) return;
    addToShortlist.mutate(candidate.id, {
      onSuccess: (res) =>
        toast(
          res.duplicate
            ? t('search.alreadyInShortlist')
            : t('search.addedToShortlist'),
          res.duplicate ? 'info' : 'success',
        ),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">{t('candidateDetail.notFound')}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="me-2 size-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const fullName =
    [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || '—';

  const experiences = candidate.experiences ?? [];
  const work = experiences.filter((e) => e.type === 'work');
  const education = experiences.filter((e) => e.type === 'education');
  const projects = candidate.projects ?? [];
  const certifications = candidate.certifications ?? [];
  const links = candidate.links ?? [];

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label={t('common.back')}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{t('candidateDetail.title')}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="relative p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="-mt-16 flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
              {(candidate.firstName?.[0] ?? '?').toUpperCase()}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
                {candidate.featured && (
                  <Badge variant="default" className="gap-1">
                    <Star className="size-3" />
                    Featured
                  </Badge>
                )}
              </div>

              {candidate.anonymized && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {t('candidateDetail.anonymizedHint')}
                </p>
              )}

              {candidate.headline && (
                <p className="mt-1 text-muted-foreground">{candidate.headline}</p>
              )}

              {/* Valuing signals: score, school (+verified) and completed
                  evaluations — the same comparison signals as the list card. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <CandidateScoreBadge
                  score={candidate.score ?? 0}
                  percentile={candidate.percentile ?? null}
                />
                {candidate.school && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <GraduationCap className="size-4" />
                    {candidate.school}
                    {candidate.schoolVerified && (
                      <ShieldCheck
                        className="size-4 text-success"
                        aria-label={t('search.schoolVerified')}
                      />
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClipboardCheck className="size-4" />
                  {t('search.assessmentsCount', {
                    count: String(candidate.assessmentCount ?? 0),
                  })}
                </span>
              </div>

              {/* EF-CAND-05 — availability / mobility / salary (when disclosed) */}
              {(candidate.availability ||
                candidate.mobility ||
                candidate.salaryMin != null) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.availability && (
                    <Badge variant="secondary">
                      {t('candidateDetail.availability')}: {candidate.availability}
                    </Badge>
                  )}
                  {candidate.mobility && (
                    <Badge variant="secondary">
                      {t('candidateDetail.mobility')}: {candidate.mobility}
                    </Badge>
                  )}
                  {candidate.salaryMin != null && (
                    <Badge variant="secondary">
                      {t('candidateDetail.salary')}:{' '}
                      {candidate.salaryMin.toLocaleString()}
                      {candidate.salaryMax != null
                        ? `–${candidate.salaryMax.toLocaleString()}`
                        : ''}{' '}
                      {candidate.salaryCurrency ?? 'MAD'}
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                {candidate.location && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {candidate.location}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:flex-col">
              <Button className="gap-2" onClick={handleAdd} disabled={addToShortlist.isPending}>
                {addToShortlist.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {t('search.addToShortlist')}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setMessageOpen(true)}
              >
                <MessageSquare className="size-4" />
                {t('search.contact')}
              </Button>
              {candidate.cv ? (
                <a
                  href={candidate.cv.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={candidate.cv.originalName}
                >
                  <Button variant="outline" className="w-full gap-2">
                    <Download className="size-4" />
                    {t('candidateDetail.downloadCv')}
                    <span className="text-xs text-muted-foreground">
                      ({formatBytes(candidate.cv.size)})
                    </span>
                  </Button>
                </a>
              ) : candidate.anonymized ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {t('candidateDetail.cvLockedHint')}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {candidate.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              {t('candidateDetail.skills')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {candidate.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              {t('candidateDetail.about')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {candidate.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {work.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="size-4 text-primary" />
              {t('candidateDetail.experience')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {work.map((e, i) => (
              <div
                key={`${e.title}-${i}`}
                className="border-s-2 border-border ps-4"
              >
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <p className="text-sm text-muted-foreground">{e.organization}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRange(
                    e.startDate,
                    e.endDate,
                    locale,
                    t('candidateDetail.present'),
                  )}
                </p>
                {e.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {e.description}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4 text-primary" />
              {t('candidateDetail.education')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {education.map((e, i) => (
              <div
                key={`${e.title}-${i}`}
                className="border-s-2 border-border ps-4"
              >
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <p className="text-sm text-muted-foreground">{e.organization}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRange(
                    e.startDate,
                    e.endDate,
                    locale,
                    t('candidateDetail.present'),
                  )}
                </p>
                {e.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {e.description}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderGit2 className="size-4 text-primary" />
              {t('candidateDetail.projects')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {projects.map((p, i) => (
              <div
                key={`${p.title}-${i}`}
                className="border-s-2 border-border ps-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {t('candidateDetail.viewProject')}
                    </a>
                  )}
                </div>
                {(p.role ||
                  formatRange(
                    p.startDate,
                    p.endDate,
                    locale,
                    t('candidateDetail.present'),
                  )) && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      p.role,
                      formatRange(
                        p.startDate,
                        p.endDate,
                        locale,
                        t('candidateDetail.present'),
                      ),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {p.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-primary" />
              {t('candidateDetail.certifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {certifications.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.issuer, formatMonth(c.issueDate, locale)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {c.credentialUrl && (
                  <a
                    href={c.credentialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {t('candidateDetail.viewCredential')}
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {links.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4 text-primary" />
              {t('candidateDetail.links')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {links.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <ExternalLink className="size-3.5" />
                {l.label || l.type}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <MessagePopup
        open={messageOpen}
        onOpenChange={setMessageOpen}
        candidateProfileId={candidate.id}
        candidateName={
          [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') ||
          null
        }
      />
    </motion.div>
  );
}
