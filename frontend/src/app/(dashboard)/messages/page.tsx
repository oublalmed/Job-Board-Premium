'use client';

import { useState } from 'react';
import { Send, Loader2, MessagesSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  openConversationSchema,
  EMPTY_CONVERSATION,
  type OpenConversationValues,
} from '@/features/messages/schema';
import { useOpenConversation } from '@/features/messages/queries';
import { ConversationList } from '@/features/messages/ConversationList';
import { MessageThread } from '@/features/messages/MessageThread';

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

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openConversation = useOpenConversation();
  const form = useForm<OpenConversationValues>({
    resolver: zodResolver(openConversationSchema),
    defaultValues: EMPTY_CONVERSATION,
  });

  const onSubmit = form.handleSubmit((values) => {
    openConversation.mutate(values, {
      onSuccess: (conversation) => {
        toast(t('messages.conversationOpened'), 'success');
        form.reset(EMPTY_CONVERSATION);
        setSelectedId(conversation.id);
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  });

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
            <Form {...form}>
              <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="candidateProfileId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('messages.candidateId')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('messages.candidateIdPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('messages.firstMessage')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder={t('messages.firstMessagePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={openConversation.isPending}
                  className="gap-2 self-start"
                >
                  {openConversation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {openConversation.isPending ? t('messages.sending') : t('messages.send')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden p-0">
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
        </Card>

        <Card className="min-h-[420px]">
          <CardContent className="flex h-full flex-col p-4">
            {selectedId ? (
              <div className="flex h-[420px] flex-col">
                <MessageThread conversationId={selectedId} />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <MessagesSquare className="size-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('messages.selectThread')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
