'use client';

import { useLocale } from '@/i18n/locale-context';
import { Badge } from '@/components/ui/badge';
import { useUnreadMessageCount } from './queries';

/**
 * EF-MSG-02 — a global "new messages" indicator for the Messages nav item.
 * Renders nothing when there is nothing unread (no empty chrome), caps the
 * displayed number at "9+" so the nav stays compact, and carries an explicit
 * aria-label so the count is announced rather than read as a bare number.
 */
export function MessagesNavBadge() {
  const { t } = useLocale();
  const count = useUnreadMessageCount();

  if (count <= 0) return null;

  const display = count > 9 ? '9+' : String(count);

  return (
    <Badge
      variant="default"
      className="ms-auto h-5 min-w-5 justify-center px-1.5 tabular-nums"
      aria-label={t('messages.unreadBadge', { count: String(count) })}
    >
      {display}
    </Badge>
  );
}
