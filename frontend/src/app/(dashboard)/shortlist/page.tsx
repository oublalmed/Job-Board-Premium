'use client';

import { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ShortlistEntry {
  id: string;
  candidateProfile?: {
    id: string;
    firstName?: string;
    lastName?: string;
    headline?: string;
  };
  note?: string;
  createdAt: string;
}

export default function ShortlistPage() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);

  useEffect(() => {
    void loadEntries();
  }, []);

  async function loadEntries() {
    const { data } = await apiClient.GET('/api/v1/companies/shortlist');
    if (data && Array.isArray(data)) {
      setEntries(data as ShortlistEntry[]);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('nav.shortlist')}</h1>

      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <Card key={entry.id} className="transition-all duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Heart className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {entry.candidateProfile?.firstName} {entry.candidateProfile?.lastName}
                  </h3>
                  {entry.candidateProfile?.headline && (
                    <p className="text-sm text-muted-foreground">{entry.candidateProfile.headline}</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <Heart className="mx-auto mb-4 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
