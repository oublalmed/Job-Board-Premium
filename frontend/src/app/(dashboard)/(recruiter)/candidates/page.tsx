'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Star,
  UserPlus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Table2,
  AlertCircle,
  ArrowDownWideNarrow,
  GraduationCap,
  ShieldCheck,
  ClipboardCheck,
  MessageSquare,
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
import { SavedSearchesPanel } from '@/features/candidates/saved-searches-panel';
import { AnonymizedHint } from '@/features/candidates/AnonymizedHint';
import { CandidateScoreBadge } from '@/features/candidates/CandidateScoreBadge';
import { MessagePopup } from '@/features/messages/MessagePopup';
import {
  useAddToShortlist,
  useCandidateSearch,
} from '@/features/candidates/queries';
import {
  activeFilterCount,
  isAnonymized,
  type CandidateFilters,
  type CandidateResult,
  type SearchSort,
} from '@/features/candidates/types';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

// §8 — the grande-école reference (matches the backend list). Combinable filter.
const REFERENCE_SCHOOLS = [
  'ENSIAS',
  'EMI',
  'INPT',
  'ENIM',
  'EHTP',
  'INSEA',
  'UM6P',
  'UIR',
  'ENSEM',
  'ESITH',
  'EMSI',
] as const;

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
  // The candidate whose "Contacter" popup is open (from a list card / table row).
  const [contactTarget, setContactTarget] = useState<{
    id: string;
    name: string | null;
  } | null>(null);

  const search = useCandidateSearch(filters, hasSearched);
  const addToShortlist = useAddToShortlist();

  // Page-based pagination over the cursor-paginated results: show one page
  // (12 results) at a time. `fetchNextPage` loads the next cursor page lazily,
  // so "Next" fetches only when the recruiter actually advances.
  // Reset to the first page whenever a new search is run (see runSearch /
  // applySavedSearch), so results never open on a stale page number.
  const [pageIndex, setPageIndex] = useState(0);

  const loadedPages = search.data?.pages.length ?? 0;
  const candidates = useMemo(
    () => search.data?.pages[pageIndex]?.items ?? [],
    [search.data, pageIndex],
  );
  const canPrev = pageIndex > 0;
  const canNext = pageIndex + 1 < loadedPages || search.hasNextPage;

  async function goToNextPage() {
    if (pageIndex + 1 < loadedPages) {
      setPageIndex((p) => p + 1);
    } else if (search.hasNextPage) {
      await search.fetchNextPage();
      setPageIndex((p) => p + 1);
    }
  }

  const addingId = addToShortlist.isPending ? addToShortlist.variables : null;

  function runSearch() {
    setPageIndex(0);
    apply(draft);
  }

  // §7 — changing the sort re-runs on the last-applied criteria immediately.
  function changeSort(sort: SearchSort) {
    setDraft((d) => ({ ...d, sort }));
    setPageIndex(0);
    apply({ ...filters, sort });
  }

  function toggleSchool(school: string) {
    setDraft((d) => ({
      ...d,
      schools: d.schools.includes(school)
        ? d.schools.filter((s) => s !== school)
        : [...d.schools, school],
    }));
  }

  // Re-apply a saved search: hydrate the visible filter inputs and run it.
  function applySavedSearch(next: CandidateFilters) {
    setPageIndex(0);
    setDraft(next);
    apply(next);
  }

  function openContact(c: CandidateResult) {
    setContactTarget({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
    });
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
                      {t('search.featured')}
                    </Badge>
                  )}
                </div>
                {c.headline && (
                  <p className="truncate text-xs text-muted-foreground">{c.headline}</p>
                )}
                {isAnonymized(c) && <AnonymizedHint />}
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
        accessorKey: 'school',
        header: t('search.school'),
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original;
          if (!c.school) return '—';
          return (
            <span className="flex items-center gap-1">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              <span className="truncate">{c.school}</span>
              {c.schoolVerified && (
                <ShieldCheck
                  className="size-3.5 shrink-0 text-success"
                  aria-label={t('search.schoolVerified')}
                />
              )}
            </span>
          );
        },
      },
      {
        id: 'assessments',
        header: t('search.assessments'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-sm">
            <ClipboardCheck className="size-3.5 text-muted-foreground" />
            {row.original.assessmentCount ?? 0}
          </span>
        ),
      },
      {
        id: 'score',
        // EF-RECR-04 — the score/ranking column, made explicit on screen. The
        // list is server-ordered by score desc, so the row index (1-based) is
        // the candidate's rank.
        header: t('search.rankHeader'),
        enableSorting: false,
        cell: ({ row }) => (
          <CandidateScoreBadge
            score={row.original.score}
            percentile={row.original.percentile}
            rank={row.index + 1}
          />
        ),
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
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => openContact(c)}
              >
                <MessageSquare className="size-3.5" />
                <span className="hidden lg:inline">{t('search.contact')}</span>
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
        <div className="flex flex-col gap-3 sm:flex-row">
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
          <div className="flex gap-3">
            <Button
              onClick={runSearch}
              disabled={search.isFetching && !search.isFetchingNextPage}
              className="flex-1 sm:flex-none"
            >
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
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, availability: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.availabilityPlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">{t('search.salaryMax')}</Label>
                  <Input
                    inputMode="numeric"
                    value={draft.salaryMax}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, salaryMax: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder={t('search.salaryMaxPlaceholder')}
                  />
                </div>
              </div>

              {/* §8 — school filter (combinable, multi-select). */}
              <div className="mt-4">
                <Label className="text-xs">{t('search.schools')}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {REFERENCE_SCHOOLS.map((s) => {
                    const active = draft.schools.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleSchool(s)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <SavedSearchesPanel
          currentFilters={draft}
          onApply={applySavedSearch}
        />
      </div>

      {/* §7 / EF-RECR-04 — sort control. Default is score desc (highest score
          first); the recruiter can re-order the result set. */}
      {!search.isError && !search.isLoading && candidates.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowDownWideNarrow className="size-3.5 shrink-0" aria-hidden="true" />
          <label htmlFor="candidate-sort">{t('search.sortBy')}</label>
          <select
            id="candidate-sort"
            value={draft.sort}
            onChange={(e) => changeSort(e.target.value as SearchSort)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="score_desc">{t('search.sortScoreDesc')}</option>
            <option value="score_asc">{t('search.sortScoreAsc')}</option>
            <option value="recent">{t('search.sortRecent')}</option>
            <option value="active">{t('search.sortActive')}</option>
          </select>
        </div>
      )}

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
            candidates.map((candidate, index) => (
              <Card key={candidate.id} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold text-primary">
                    {(candidate.firstName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">
                        {candidate.firstName} {candidate.lastName}
                      </h3>
                      {candidate.featured && (
                        <Badge variant="default" className="gap-1">
                          <Star className="size-3" />
                          {t('search.featured')}
                        </Badge>
                      )}
                      {/* EF-RECR-04 — rank (1-based position in the
                          score-ordered list) + score, on screen. */}
                      <CandidateScoreBadge
                        score={candidate.score}
                        percentile={candidate.percentile}
                        rank={index + 1}
                      />
                    </div>
                    {candidate.headline && (
                      <p className="truncate text-sm text-muted-foreground">
                        {candidate.headline}
                      </p>
                    )}
                    {isAnonymized(candidate) && <AnonymizedHint />}
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {candidate.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" /> {candidate.location}
                        </span>
                      )}
                      {candidate.school && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="size-3" /> {candidate.school}
                          {candidate.schoolVerified && (
                            <ShieldCheck
                              className="size-3 text-success"
                              aria-label={t('search.schoolVerified')}
                            />
                          )}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="size-3" />
                        {t('search.assessmentsCount', {
                          count: String(candidate.assessmentCount ?? 0),
                        })}
                      </span>
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
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openContact(candidate)}
                    >
                      <MessageSquare className="size-3.5" />
                      <span className="hidden sm:inline">{t('search.contact')}</span>
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

      {hasSearched && !search.isLoading && candidates.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={!canPrev}
          >
            <ChevronLeft className="size-4" />
            {t('search.previous')}
          </Button>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {t('search.page', { n: String(pageIndex + 1) })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void goToNextPage()}
            disabled={!canNext || search.isFetchingNextPage}
          >
            {search.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
            {t('search.next')}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {contactTarget && (
        <MessagePopup
          key={contactTarget.id}
          open
          onOpenChange={(o) => {
            if (!o) setContactTarget(null);
          }}
          candidateProfileId={contactTarget.id}
          candidateName={contactTarget.name}
        />
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
