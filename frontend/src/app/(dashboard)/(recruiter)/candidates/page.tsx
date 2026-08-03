'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  MapPin,
  Star,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CandidateResult {
  id: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  availability?: string;
  featured?: boolean;
}

interface SearchResponse {
  results: CandidateResult[];
  nextCursor?: string | null;
  total?: number;
}

export default function CandidatesPage() {
  const { t } = useLocale();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [skills, setSkills] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [mobilityFilter, setMobilityFilter] = useState('');

  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const doSearch = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = {};
        if (query.trim()) params.q = query.trim();
        if (skills.trim()) params.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
        if (locationFilter.trim()) params.location = locationFilter.trim();
        if (availabilityFilter.trim()) params.availability = availabilityFilter.trim();
        if (mobilityFilter.trim()) params.mobility = mobilityFilter.trim();
        if (cursor) params.cursor = cursor;
        params.limit = 20;

        const { data } = await apiClient.GET('/api/v1/search/candidates', {
          params: { query: params as never },
        });

        if (data) {
          const result = data as SearchResponse;
          if (cursor) {
            setCandidates((prev) => [...prev, ...(result.results ?? [])]);
          } else {
            setCandidates(result.results ?? []);
          }
          setNextCursor(result.nextCursor ?? null);
        }
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [query, skills, locationFilter, availabilityFilter, mobilityFilter],
  );

  async function handleAddToShortlist(candidateProfileId: string) {
    setAddingIds((prev) => new Set(prev).add(candidateProfileId));
    try {
      const { error } = await apiClient.POST('/api/v1/companies/shortlist', {
        body: { candidateProfileId },
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('already') || msg.includes('duplicate') || msg.includes('unique')) {
          toast(t('search.alreadyInShortlist'), 'info');
        } else {
          toast(t('common.error'), 'error');
        }
        return;
      }
      toast(t('search.addedToShortlist'), 'success');
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateProfileId);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('search.title')}</h1>

      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
              className="ps-10"
            />
          </div>
          <Button onClick={() => void doSearch()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {t('search.filters')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters((prev) => !prev)}
            className="gap-1"
          >
            {showFilters ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            {showFilters ? t('search.hideFilters') : t('search.showFilters')}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.skills')}</Label>
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder={t('search.skillsPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.location')}</Label>
                  <Input
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder={t('search.locationPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.availability')}</Label>
                  <Input
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    placeholder={t('search.availabilityPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.mobility')}</Label>
                  <Input
                    value={mobilityFilter}
                    onChange={(e) => setMobilityFilter(e.target.value)}
                    placeholder={t('search.mobilityPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="transition-all duration-200 hover:shadow-md">
            <CardContent className="flex items-center gap-6 p-5">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {(candidate.firstName?.[0] ?? '?').toUpperCase()}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {candidate.firstName} {candidate.lastName}
                  </h3>
                  {candidate.featured && (
                    <Badge variant="default" className="gap-1">
                      <Star className="size-3" />
                      Featured
                    </Badge>
                  )}
                </div>
                {candidate.headline && (
                  <p className="text-sm text-muted-foreground">{candidate.headline}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {candidate.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" /> {candidate.location}
                    </span>
                  )}
                  {candidate.availability && (
                    <span>{candidate.availability}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/candidates/${candidate.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Eye className="size-3.5" />
                    {t('search.viewProfile')}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void handleAddToShortlist(candidate.id)}
                  disabled={addingIds.has(candidate.id)}
                >
                  <UserPlus className="size-3.5" />
                  {t('search.addToShortlist')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {searched && !loading && candidates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Search className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => void doSearch(nextCursor)}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('search.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
