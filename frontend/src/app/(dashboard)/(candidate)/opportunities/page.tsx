'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  AlertCircle,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateCasablanca } from '@/lib/format';
import {
  useJobSearch,
  useMyApplications,
  CONTRACT_TYPES,
  type JobContractType,
  type JobSearchFilters,
  type JobOfferWithCount,
} from '@/features/jobs/queries';
import {
  JOB_STATUS_BADGE,
  APPLICATION_STATUS_BADGE,
  contractTypeKey,
} from '@/features/jobs/labels';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

type Tab = 'browse' | 'mine';

export default function OpportunitiesPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('browse');

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Briefcase className="size-6 text-primary" />
          {t('jobs.candidate.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('jobs.candidate.subtitle')}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'browse'} onClick={() => setTab('browse')}>
          {t('jobs.candidate.browseTab')}
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          {t('jobs.candidate.myApplicationsTab')}
        </TabButton>
      </div>

      {tab === 'browse' ? <BrowseTab /> : <MyApplicationsTab />}
    </motion.div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </button>
  );
}

function BrowseTab() {
  const { t } = useLocale();
  const [draft, setDraft] = useState<JobSearchFilters>({
    q: '',
    location: '',
    contractType: '',
    skills: [],
  });
  const [filters, setFilters] = useState<JobSearchFilters>({});

  const search = useJobSearch(filters);
  const offers = search.data?.pages.flatMap((p) => p.items) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({
      q: draft.q?.trim() || undefined,
      location: draft.location?.trim() || undefined,
      contractType: draft.contractType || undefined,
      skills:
        draft.skills && draft.skills.length > 0 ? draft.skills : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={runSearch}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="q">{t('jobs.candidate.searchLabel')}</Label>
              <Input
                id="q"
                value={draft.q ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                placeholder={t('jobs.candidate.searchPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc">{t('jobs.form.location')}</Label>
              <Input
                id="loc"
                value={draft.location ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, location: e.target.value }))
                }
                placeholder={t('jobs.form.locationPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ct">{t('jobs.form.contractType')}</Label>
              <Select
                id="ct"
                value={draft.contractType ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    contractType: e.target.value as JobContractType | '',
                  }))
                }
              >
                <option value="">{t('jobs.form.any')}</option>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(contractTypeKey(c))}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2">
                <Search className="size-4" />
                {t('jobs.candidate.searchButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {search.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {search.isError && !search.isLoading && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('common.error')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void search.refetch()}
            >
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {!search.isLoading && !search.isError && offers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Search className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('jobs.candidate.noResultsTitle')}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t('jobs.candidate.noResultsBody')}
            </p>
          </CardContent>
        </Card>
      )}

      {!search.isLoading && !search.isError && offers.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('jobs.candidate.resultCount', { count: String(total) })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
          {search.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void search.fetchNextPage()}
                disabled={search.isFetchingNextPage}
              >
                {search.isFetchingNextPage && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t('jobs.candidate.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: JobOfferWithCount }) {
  const { t } = useLocale();
  return (
    <Link href={`/opportunities/${offer.id}`} className="group">
      <Card className="h-full transition-all duration-200 hover:shadow-md group-hover:border-primary/40">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <h3 className="font-semibold text-foreground group-hover:text-primary">
            {offer.title}
          </h3>
          {offer.company?.name && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5" />
              {offer.company.name}
            </span>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {offer.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {offer.location}
              </span>
            )}
            {offer.contractType && (
              <span className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" />
                {t(contractTypeKey(offer.contractType))}
              </span>
            )}
          </div>
          {offer.skills && offer.skills.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {offer.skills.slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function MyApplicationsTab() {
  const { t, locale } = useLocale();
  const { data, isLoading, isError, refetch } = useMyApplications();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t('common.error')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t('jobs.candidate.noApplicationsTitle')}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t('jobs.candidate.noApplicationsBody')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {data.map((app) => {
        const badge = APPLICATION_STATUS_BADGE[app.status];
        return (
          <li key={app.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-col">
                  <Link
                    href={`/opportunities/${app.offer.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {app.offer.title}
                  </Link>
                  {app.offer.companyName && (
                    <span className="text-xs text-muted-foreground">
                      {app.offer.companyName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t('jobs.detail.appliedOn', {
                      date: formatDateCasablanca(new Date(app.createdAt), locale),
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {app.offer.status === 'closed' && (
                    <Badge variant={JOB_STATUS_BADGE.closed.variant}>
                      {t(JOB_STATUS_BADGE.closed.key)}
                    </Badge>
                  )}
                  <Badge variant={badge.variant}>{t(badge.key)}</Badge>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
