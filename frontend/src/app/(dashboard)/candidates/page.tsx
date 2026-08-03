'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Star, UserPlus, Eye } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CandidateResult {
  id: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  availability?: string;
  bestScore?: number;
  bestPercentile?: number;
  featured?: boolean;
}

export default function CandidatesPage() {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (query.trim()) params.q = query.trim();
      const { data } = await apiClient.GET('/api/v1/search/candidates', {
        params: { query: params as never },
      });
      if (data) {
        setCandidates((data as Record<string, unknown>).results as CandidateResult[] ?? []);
      }
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('search.title')}</h1>
      </div>

      {/* Search bar */}
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
          <Search className="size-4" />
          {t('search.filters')}
        </Button>
      </div>

      {/* Results */}
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
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  {candidate.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" /> {candidate.location}
                    </span>
                  )}
                  {candidate.bestScore != null && (
                    <span>Score: {candidate.bestScore}/100</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Eye className="size-4" />
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <UserPlus className="size-3.5" />
                  {t('search.addToShortlist')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {searched && candidates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Search className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
