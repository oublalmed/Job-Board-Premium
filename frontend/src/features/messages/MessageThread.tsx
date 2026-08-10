'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import { useMessages, useSendMessage } from './queries';

// Reusable thread view: message bubbles (mine vs theirs) + a composer.
// Used both by the full messages page and the candidate-detail popup.
export function MessageThread({ conversationId }: { conversationId: string }) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const { data: messages, isLoading } = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const [draft, setDraft] = useState('');

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-1">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ms-auto h-12 w-1/2" />
          </>
        ) : !messages || messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('messages.emptyThread')}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-0.5 ${m.mine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.mine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {m.body}
              </div>
              <span className="px-1 text-[11px] text-muted-foreground">
                {formatDateCasablanca(new Date(m.createdAt), locale)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-end gap-2 border-t border-border/60 pt-3">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('messages.replyPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="min-h-0 flex-1 resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={send.isPending || !draft.trim()}
          className="gap-2"
          aria-label={t('messages.send')}
        >
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
