'use client';

import { Bell, CheckCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/features/notifications/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const { t } = useLocale();
  const { data, isLoading, isError, refetch } = useNotifications();
  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('notifications.title')}</h1>
        {!isLoading && !isError && notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <Badge variant="default">{unreadCount} new</Badge>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCheck className="size-4" />
                All read
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {isError && (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{t('common.error')}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          !isError &&
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`transition-all duration-200 hover:shadow-md ${
                !n.readAt ? 'border-primary/20 bg-primary/[0.02]' : ''
              }`}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className="relative mt-0.5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <Bell className="size-5 text-primary" />
                  </div>
                  {!n.readAt && (
                    <div className="absolute -end-0.5 -top-0.5 size-3 animate-pulse rounded-full border-2 border-card bg-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}

        {!isLoading && !isError && notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Bell className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
