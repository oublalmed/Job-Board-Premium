'use client';

import { useState, useEffect } from 'react';
import { Briefcase, MapPin } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/schema';

type JobOffer = components['schemas']['JobOffer'];

export default function JobsPage() {
  const { t } = useLocale();
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadOffers();
  }, []);

  async function loadOffers() {
    setLoading(true);
    try {
      const { data } = await apiClient.GET('/api/v1/companies/offers');
      if (data) {
        const published = data.filter((o) => o.status === 'published');
        setOffers(published);
      }
    } finally {
      setLoading(false);
    }
  }

  function statusVariant(status: string) {
    switch (status) {
      case 'published':
        return 'success' as const;
      case 'pending_moderation':
        return 'warning' as const;
      case 'rejected':
        return 'destructive' as const;
      case 'closed':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('jobs.title')}</h1>

      <div className="flex flex-col gap-4">
        {loading && (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        )}

        {!loading &&
          offers.map((offer) => (
            <Card key={offer.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-start gap-5 p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                  <Briefcase className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{offer.title}</h3>
                    <Badge variant={statusVariant(offer.status)}>
                      {t(`offers.status.${offer.status}`)}
                    </Badge>
                  </div>
                  {offer.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {offer.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {offer.company?.name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {offer.company.name}
                      </span>
                    )}
                    <span>
                      {t('jobs.postedOn')} {new Date(offer.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {!loading && offers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <Briefcase className="mx-auto mb-4 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('jobs.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
