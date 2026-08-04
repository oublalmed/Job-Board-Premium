'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Star,
  Briefcase,
  Globe,
  UserPlus,
  MessageSquare,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface CandidateDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  availability: string | null;
  mobility: string | null;
  location: string | null;
  skills: string[];
  featured: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function CandidateDetailPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addingToShortlist, setAddingToShortlist] = useState(false);

  useEffect(() => {
    if (!id) return;
    void loadCandidate();
  }, [id]);

  async function loadCandidate() {
    setLoading(true);
    setError(false);
    try {
      const { data, error: apiError } = await apiClient.GET(
        '/api/v1/search/candidates/{id}',
        { params: { path: { id } } },
      );
      if (apiError || !data) {
        setError(true);
        return;
      }
      setCandidate(data as unknown as CandidateDetail);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToShortlist() {
    if (!candidate) return;
    setAddingToShortlist(true);
    try {
      const { error: apiError } = await apiClient.POST('/api/v1/companies/shortlist', {
        body: { candidateProfileId: candidate.id },
      });
      if (apiError) {
        const msg = (apiError as { message?: string }).message ?? '';
        if (msg.includes('already') || msg.includes('duplicate') || msg.includes('unique')) {
          toast(t('search.alreadyInShortlist'), 'info');
        } else {
          toast(t('common.error'), 'error');
        }
        return;
      }
      toast(t('search.addedToShortlist'), 'success');
    } finally {
      setAddingToShortlist(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">{t('candidateDetail.notFound')}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || '—';

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
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

              {candidate.headline && (
                <p className="mt-1 text-muted-foreground">{candidate.headline}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                {candidate.location && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {candidate.location}
                  </span>
                )}
                {candidate.availability && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Briefcase className="size-4" />
                    {candidate.availability}
                  </span>
                )}
                {candidate.mobility && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Globe className="size-4" />
                    {candidate.mobility}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:flex-col">
              <Button
                className="gap-2"
                onClick={() => void handleAddToShortlist()}
                disabled={addingToShortlist}
              >
                {addingToShortlist ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {t('search.addToShortlist')}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => router.push('/messages')}
              >
                <MessageSquare className="size-4" />
                {t('search.contact')}
              </Button>
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
    </motion.div>
  );
}
