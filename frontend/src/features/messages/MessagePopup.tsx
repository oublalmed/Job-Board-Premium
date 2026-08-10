'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { MessageThread } from './MessageThread';
import { useOpenConversation } from './queries';

// Reusable "message this candidate" popup. Opens (or re-opens) the thread:
// the recruiter types a first message; on success we switch to the live
// thread. openConversation is idempotent server-side, so if a thread already
// exists it's reused rather than duplicated.
export function MessagePopup({
  open,
  onOpenChange,
  candidateProfileId,
  candidateName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateProfileId: string;
  candidateName: string | null;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const openConversation = useOpenConversation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function handleSend() {
    const body = message.trim();
    if (!body) return;
    openConversation.mutate(
      { candidateProfileId, message: body },
      {
        onSuccess: (conversation) => {
          setConversationId(conversation.id);
          setMessage('');
          toast(t('messages.conversationOpened'), 'success');
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : undefined;
          toast(
            status === 402
              ? t('messages.quotaExceeded')
              : t('common.error'),
            'error',
          );
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex max-h-[80vh] flex-col">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            {candidateName
              ? t('messages.popupTitle', { name: candidateName })
              : t('messages.title')}
          </DialogTitle>
          {!conversationId && (
            <DialogDescription>{t('messages.popupHint')}</DialogDescription>
          )}
        </DialogHeader>

        {conversationId ? (
          <div className="h-[50vh]">
            <MessageThread conversationId={conversationId} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('messages.firstMessagePlaceholder')}
            />
            <Button
              onClick={handleSend}
              disabled={openConversation.isPending || !message.trim()}
              className="gap-2 self-end"
            >
              {openConversation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {t('messages.send')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
