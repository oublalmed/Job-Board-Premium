'use client';

import { useRef, useState } from 'react';
import { Loader2, Send, Flag, Paperclip, FileText, Download } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import {
  useMessages,
  useSendMessage,
  useSendAttachment,
  useReportConversation,
  fetchAttachmentUrl,
} from './queries';

// EF-MSG-03 — mirror the backend rules (PDF/DOCX ≤5MB) for instant feedback.
const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;
const ATTACHMENT_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Reusable thread view: message bubbles (mine vs theirs) + a composer.
// Used both by the full messages page and the candidate-detail popup.
export function MessageThread({ conversationId }: { conversationId: string }) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const { data: messages, isLoading } = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const sendAttachment = useSendAttachment(conversationId);
  const report = useReportConversation(conversationId);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so selecting the same file twice re-triggers change.
    e.target.value = '';
    if (!file) return;
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
      toast(t('messageAttachments.invalidType'), 'error');
      return;
    }
    if (file.size > ATTACHMENT_MAX_SIZE) {
      toast(t('messageAttachments.tooLarge'), 'error');
      return;
    }
    sendAttachment.mutate(
      { file, body: draft.trim() || undefined },
      {
        onSuccess: () => setDraft(''),
        onError: () => toast(t('messageAttachments.uploadError'), 'error'),
      },
    );
  }

  async function handleDownload(messageId: string) {
    try {
      const { url } = await fetchAttachmentUrl(conversationId, messageId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast(t('messageAttachments.downloadError'), 'error');
    }
  }

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleReport() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    report.mutate(trimmed, {
      onSuccess: () => {
        toast(t('messages.reportSent'), 'success');
        setReporting(false);
        setReason('');
      },
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
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.attachment && (
                  <button
                    type="button"
                    onClick={() => handleDownload(m.id)}
                    className={`mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      m.mine
                        ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25'
                        : 'bg-background/70 hover:bg-background'
                    }`}
                  >
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">
                      {m.attachment.originalName}
                    </span>
                    <Download className="size-3.5 shrink-0 opacity-70" />
                  </button>
                )}
              </div>
              <span className="px-1 text-[11px] text-muted-foreground">
                {formatDateCasablanca(new Date(m.createdAt), locale)}
              </span>
            </div>
          ))
        )}
      </div>

      {reporting && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <label
            htmlFor="report-reason"
            className="text-xs font-medium text-destructive"
          >
            {t('messages.reportReasonLabel')}
          </label>
          <Textarea
            id="report-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('messages.reportPlaceholder')}
            className="min-h-0 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReporting(false);
                setReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={report.isPending || reason.trim().length < 3}
              onClick={handleReport}
            >
              {report.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('messages.reportSubmit')}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => setReporting((v) => !v)}
        >
          <Flag className="size-3.5" />
          {t('messages.report')}
        </Button>
      </div>

      <div className="mt-1 flex items-end gap-2 border-t border-border/60 pt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileSelected}
        />
        <Button
          variant="ghost"
          size="icon"
          disabled={sendAttachment.isPending}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('messageAttachments.attach')}
          title={t('messageAttachments.attach')}
        >
          {sendAttachment.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
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
