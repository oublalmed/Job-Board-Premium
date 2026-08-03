'use client';

import { MessageSquare } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';

export default function MessagesPage() {
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('messages.title')}</h1>

      <div className="rounded-2xl border border-dashed border-border p-16 text-center">
        <MessageSquare className="mx-auto mb-4 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t('messages.noConversations')}</p>
      </div>
    </div>
  );
}
