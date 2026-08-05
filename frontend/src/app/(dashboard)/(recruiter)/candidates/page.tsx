'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Star,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Table2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { useCandidateSearchStore } from '@/features/candidates/search-store';
import {
  useAddToShortlist,
  useCandidateSearch,
} from '@/features/candidates/queries';
import {
  activeFilterCount,
  type CandidateFilters,
  type CandidateResult,
} from '@/features/candidates/types';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function CandidateAvatar({ candidate }: { candidate: CandidateResult }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-base font-semibold text-primary">
      {(candidate.firstName?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

export default function CandidatesPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { filters, view, hasSearched, apply, setView } = useCandidateSearchStore();

  const [draft, setDraft] = useState<CandidateFilters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const search = useCandidateSearch(filters, hasSearched);
  const addToShortlist = useAddToShortlist();

  const candidates = useMemo(
    () => search.data?.pages.flatMap((p) => p.results ?? []) ?? [],
    [search.data],
  );

  const addingId = addToShortlist.isPending ? addToShortlist.variables : null;

  function runSearch() {
    apply(draft);
  }

  function handleAdd(id: string) {
    addToShortlist.mutate(id, {
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

  const columns = useMemo<ColumnDef<CandidateResult>[]>(
    () => [
      {
        accessorKey: 'firstName',
        header: t('nav.candidates'),
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3">
              <CandidateAvatar candidate={c} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/candidates/${c.id}`}
                    className="truncate font-medium text-foreground hover:text-primary"
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.featured && (
                    <Badge variant="default" className="gap-1">
                      <Star className="size-3" />
                      Featured
                    </Badge>
                  )}
                </div>
                {c.headline && (
                  <p className="truncate text-xs text-muted-foreground">{c.headline}</p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'location',
        header: t('search.location'),
        cell: ({ row }) => row.original.location ?? '—',
      },
      {
        accessorKey: 'availability',
        header: t('search.availability'),
        cell: ({ row }) => row.original.availability ?? '—',
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center justify-end gap-2">
              <Link href={`/candidates/${c.id}`}>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Eye className="size-3.5" />
                  <span className="hidden lg:inline">{t('search.viewProfile')}</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handleAdd(c.id)}
                disabled={addingId === c.id}
              >
                {addingId === c.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                <span className="hidden lg:inline">{t('search.addToShortlist')}</span>
              </Button>
            </div>
          );
        },
      },
    ],
    // handleAdd/t are stable enough for this render scope; addingId drives
    // the per-row disabled state and must be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, addingId],
  );

  const filtersActive = activeFilterCount(draft);

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('search.title')}</h1>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            aria-label="Card view"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
            className={`flex size-8 items-center justify-center rounded-md transition-colors ${
              view === 'cards'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Table view"
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
            className={`flex size-8 items-center justify-center rounded-md transition-colors ${
              view === 'table'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Table2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              className="ps-10"
            />
          </div>
          <Button onClick={runSearch} disabled={search.isFetching && !search.isFetchingNextPage}>
            {search.isFetching && !search.isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {t('search.filters')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters((p) => !p)}
            className="gap-1.5"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-4" />
            {showFilters ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {filtersActive > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {filtersActive}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.skills')}</Label>
                  <Input
                    value={draft.skills}
                    onChange={(e) => setDraft((d) => ({ ...d, skills: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.skillsPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.location')}</Label>
                  <Input
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.locationPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.availability')}</Label>
                  <Input
                    value={draft.availability}
                    onChange={(e) => setDraft((d) => ({ ...d, availability: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.availabilityPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.mobility')}</Label>
                  <Input
                    value={draft.mobility}
                    onChange={(e) => setDraft((d) => ({ ...d, mobility: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.mobilityPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error state */}
      {search.isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button variant="outline" size="sm" onClick={() => void search.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!search.isError && view === 'cards' && (
        <div className="flex flex-col gap-4">
          {search.isLoading && (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          )}

          {!search.isLoading &&
            candidates.map((candidate) => (
              <Card key={candidate.id} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="flex items-center gap-6 p-5">
                  <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold text-primary">
                    {(candidate.firstName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">
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
                      <p className="truncate text-sm text-muted-foreground">
                        {candidate.headline}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {candidate.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" /> {candidate.location}
                        </span>
                      )}
                      {candidate.availability && <span>{candidate.availability}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/candidates/${candidate.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <Eye className="size-3.5" />
                        <span className="hidden sm:inline">{t('search.viewProfile')}</span>
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleAdd(candidate.id)}
                      disabled={addingId === candidate.id}
                    >
                      {addingId === candidate.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">{t('search.addToShortlist')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

          {hasSearched && !search.isLoading && candidates.length === 0 && (
            <EmptyResults label={t('search.noResults')} />
          )}
        </div>
      )}

      {!search.isError && view === 'table' && (
        <DataTable
          columns={columns}
          data={candidates}
          loading={search.isLoading}
          emptyState={
            hasSearched ? <EmptyResults label={t('search.noResults')} inset /> : undefined
          }
        />
      )}

      {search.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => void search.fetchNextPage()}
            disabled={search.isFetchingNextPage}
          >
            {search.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
            {t('search.loadMore')}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function EmptyResults({ label, inset }: { label: string; inset?: boolean }) {
  return (
    <div
      className={
        inset
          ? 'p-12 text-center'
          : 'rounded-2xl border border-dashed border-border p-12 text-center'
      }
    >
      <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-muted">
        <Search className="size-7 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
