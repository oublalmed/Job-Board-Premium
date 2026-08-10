'use client';

import { Inbox } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useConversations } from './queries';

// Reusable list of the caller's threads, with counterpart name, the last
// message preview and an unread badge. Selecting one calls onSelect.
export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  const { data, isLoading } = useConversations();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="size-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t('messages.noConversations')}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {data.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              'flex w-full flex-col gap-1 border-b border-border/50 px-4 py-3 text-start transition-colors',
              selectedId === c.id ? 'bg-primary/10' : 'hover:bg-accent',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {c.counterpartName ?? t('messages.unknownParty')}
              </span>
              {c.unreadCount > 0 && (
                <Badge variant="default" className="shrink-0">
                  {c.unreadCount}
                </Badge>
              )}
            </div>
            {c.lastMessage && (
              <span className="truncate text-xs text-muted-foreground">
                {c.lastMessage.body}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
