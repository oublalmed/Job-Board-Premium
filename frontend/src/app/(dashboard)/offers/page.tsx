'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface JobOffer {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
}

export default function OffersPage() {
  const { t } = useLocale();
  const [offers, setOffers] = useState<JobOffer[]>([]);

  useEffect(() => {
    void loadOffers();
  }, []);

  async function loadOffers() {
    const { data } = await apiClient.GET('/api/v1/companies/offers');
    if (data && Array.isArray(data)) {
      setOffers(data as JobOffer[]);
    }
  }

  function statusVariant(status: string) {
    switch (status) {
      case 'published':
        return 'success' as const;
      case 'pending_moderation':
        return 'warning' as const;
      case 'closed':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('offers.title')}</h1>
        <Button className="gap-2">
          <Plus className="size-4" />
          {t('offers.create')}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {offers.map((offer) => (
          <Card key={offer.id} className="transition-all duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{offer.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(offer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant(offer.status)}>
                  {t(`offers.status.${offer.status}`)}
                </Badge>
                {offer.status === 'published' && (
                  <Button variant="outline" size="sm">
                    {t('offers.close')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {offers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('offers.noOffers')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
