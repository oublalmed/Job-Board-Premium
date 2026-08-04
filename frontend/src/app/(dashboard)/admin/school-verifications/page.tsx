'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingVerification {
  id: string;
  candidateName: string | null;
  matchedSchool: string | null;
  confidence: number | string | null;
  createdAt: string;
}

export default function AdminSchoolVerificationsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPending() {
    setLoading(true);
    try {
      const { data } = await apiClient.GET('/api/v1/admin/school-verifications');
      if (data) setItems(data as unknown as PendingVerification[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPending();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">
        {t('admin.schoolVerifications.title')}
      </h1>

      <div className="flex flex-col gap-4">
        {loading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {!loading &&
          items.map((item) => (
            <Card key={item.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <GraduationCap className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {item.candidateName ?? t('admin.schoolVerifications.unnamedCandidate')}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.matchedSchool ? (
                        <Badge variant="secondary">{item.matchedSchool}</Badge>
                      ) : (
                        <Badge variant="outline">
                          {t('admin.schoolVerifications.noMatch')}
                        </Badge>
                      )}
                      {item.confidence != null && (
                        <span>
                          {t('admin.schoolVerifications.confidence', {
                            value: String(Math.round(Number(item.confidence))),
                          })}
                        </span>
                      )}
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Link href={`/admin/school-verifications/${item.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    {t('admin.schoolVerifications.review')}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <GraduationCap className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t('admin.schoolVerifications.empty')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
