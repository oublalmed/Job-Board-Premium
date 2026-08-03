'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/schema';

type Notification = components['schemas']['Notification'];

export default function NotificationsPage() {
  const { t } = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const { data } = await apiClient.GET('/api/v1/notifications');
      if (data) setNotifications(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('notifications.title')}</h1>

      <div className="flex flex-col gap-3">
        {loading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {!loading &&
          notifications.map((n) => (
            <Card key={n.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!n.readAt && (
                  <div className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />
                )}
              </CardContent>
            </Card>
          ))}

        {!loading && notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <Bell className="mx-auto mb-4 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
