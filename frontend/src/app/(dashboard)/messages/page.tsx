'use client';

import { useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent } from '@/components/ui/card';
import { ConversationList } from '@/features/messages/ConversationList';
import { MessageThread } from '@/features/messages/MessageThread';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

// Recruiters start a conversation from the CVthèque ("Contacter" on a candidate
// card / profile), which reveals identity and consumes a contact — not from a
// raw UUID form here. This screen is the inbox: threads on the left, the
// selected conversation on the right.
export default function MessagesPage() {
  const { t } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('messages.title')}</h1>

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
