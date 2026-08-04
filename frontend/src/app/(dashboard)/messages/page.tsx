'use client';

import { useState, type FormEvent } from 'react';
import { MessageSquare, Send, Loader2, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function MessagesPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const isRecruiter = user?.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );

  const [candidateProfileId, setCandidateProfileId] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleOpenConversation(e: FormEvent) {
    e.preventDefault();
    if (!candidateProfileId.trim() || !firstMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await apiClient.POST('/api/v1/conversations', {
        body: {
          candidateProfileId: candidateProfileId.trim(),
          message: firstMessage.trim(),
        },
      });
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('messages.conversationOpened'), 'success');
      setCandidateProfileId('');
      setFirstMessage('');
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('messages.title')}</h1>

      {isRecruiter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" />
              {t('messages.startConversation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleOpenConversation(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="candidate-id">ID candidat</Label>
                <Input
                  id="candidate-id"
                  value={candidateProfileId}
                  onChange={(e) => setCandidateProfileId(e.target.value)}
                  placeholder="UUID du profil candidat"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="first-message">{t('messages.firstMessage')}</Label>
                <Textarea
                  id="first-message"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  placeholder={t('messages.firstMessagePlaceholder')}
                  rows={4}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={sending || !candidateProfileId.trim() || !firstMessage.trim()}
                className="gap-2 self-start"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {sending ? t('messages.sending') : t('messages.send')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-dashed border-border p-16 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <Inbox className="size-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t('messages.noConversations')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isRecruiter
            ? 'Start a conversation with a candidate above'
            : 'Conversations from recruiters will appear here'}
        </p>
      </div>
    </motion.div>
  );
}
