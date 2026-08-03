'use client';

import { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/schema';

type ShortlistEntry = components['schemas']['ShortlistEntry'];

export default function ShortlistPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const { data } = await apiClient.GET('/api/v1/companies/shortlist');
      if (data) {
        setEntries(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(t('shortlist.removeConfirm'))) return;
    const { error } = await apiClient.DELETE('/api/v1/companies/shortlist/{id}', {
      params: { path: { id } },
    });
    if (error) {
      toast(t('common.error'), 'error');
      return;
    }
    toast(t('shortlist.removed'), 'success');
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('shortlist.title')}</h1>

      <div className="flex flex-col gap-4">
        {loading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {!loading &&
          entries.map((entry) => (
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
                      <p className="text-sm text-muted-foreground">
                        {entry.candidateProfile.headline}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {t('shortlist.addedOn')}{' '}
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                      {entry.note && (
                        <span className="italic">
                          {t('shortlist.note')}: {entry.note}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void handleRemove(entry.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

        {!loading && entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <Heart className="mx-auto mb-4 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('shortlist.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
