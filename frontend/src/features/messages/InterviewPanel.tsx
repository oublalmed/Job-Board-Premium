'use client';

import { useState } from 'react';
import { CalendarClock, Loader2, MapPin, Video, Phone, Check, X } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/format';
import {
  useInterviews,
  useProposeInterview,
  useRespondInterview,
  type InterviewMode,
  type InterviewStatus,
  type InterviewView,
} from './queries';

const MODE_ICON: Record<InterviewMode, typeof Video> = {
  onsite: MapPin,
  video: Video,
  phone: Phone,
};

const STATUS_VARIANT: Record<
  InterviewStatus,
  'secondary' | 'success' | 'destructive'
> = {
  proposed: 'secondary',
  accepted: 'success',
  declined: 'destructive',
  cancelled: 'secondary',
};

// EF-MSG-04 — interview scheduling inside a conversation thread: propose a slot
// (any participant), then the counterpart accepts/declines while the proposer
// may cancel. Presentation + optimistic-free mutations; all rules are enforced
// server-side.
export function InterviewPanel({ conversationId }: { conversationId: string }) {
  const { t, locale } = useLocale();
  const { toast } = useToast();
  const { data: interviews, isLoading } = useInterviews(conversationId);
  const propose = useProposeInterview(conversationId);
  const respond = useRespondInterview(conversationId);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InterviewMode>('video');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  function resetForm() {
    setMode('video');
    setScheduledLocal('');
    setDuration('60');
    setLocation('');
    setNote('');
  }

  function handlePropose() {
    if (!scheduledLocal) return;
    const scheduledAt = new Date(scheduledLocal);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      toast(t('interviews.invalidDate'), 'error');
      return;
    }
    const durationMinutes = Number(duration);
    propose.mutate(
      {
        mode,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast(t('interviews.proposeSuccess'), 'success');
          resetForm();
          setOpen(false);
        },
        onError: () => toast(t('interviews.invalidDate'), 'error'),
      },
    );
  }

  function handleRespond(interviewId: string, status: InterviewStatus) {
    respond.mutate(
      { interviewId, status },
      {
        onSuccess: () => toast(t('interviews.responseSuccess'), 'success'),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <section className="mb-3 rounded-xl border border-border/60 p-3" aria-label={t('interviews.title')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarClock className="size-4 text-primary" aria-hidden="true" />
          {t('interviews.title')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {t('interviews.propose')}
        </Button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="iv-mode" className="text-xs">
                {t('interviews.mode')}
              </Label>
              <select
                id="iv-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as InterviewMode)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="video">{t('interviews.mode_video')}</option>
                <option value="onsite">{t('interviews.mode_onsite')}</option>
                <option value="phone">{t('interviews.mode_phone')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="iv-date" className="text-xs">
                {t('interviews.date')}
              </Label>
              <Input
                id="iv-date"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="iv-duration" className="text-xs">
                {t('interviews.duration')}
              </Label>
              <Input
                id="iv-duration"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="iv-location" className="text-xs">
                {t('interviews.location')}
              </Label>
              <Input
                id="iv-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('interviews.locationPlaceholder')}
              />
            </div>
          </div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('interviews.notePlaceholder')}
            className="min-h-0 resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-2"
              disabled={propose.isPending || !scheduledLocal}
              onClick={handlePropose}
            >
              {propose.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('interviews.submit')}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {isLoading ? (
          <Skeleton className="h-14" />
        ) : !interviews || interviews.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            {t('interviews.empty')}
          </p>
        ) : (
          interviews.map((iv) => (
            <InterviewRow
              key={iv.id}
              interview={iv}
              locale={locale}
              pending={respond.isPending}
              onRespond={handleRespond}
              t={t}
            />
          ))
        )}
      </div>
    </section>
  );
}

function InterviewRow({
  interview: iv,
  locale,
  pending,
  onRespond,
  t,
}: {
  interview: InterviewView;
  locale: Parameters<typeof formatDateCasablanca>[1];
  pending: boolean;
  onRespond: (id: string, status: InterviewStatus) => void;
  t: (key: string) => string;
}) {
  const ModeIcon = MODE_ICON[iv.mode];
  const canRespond = iv.status === 'proposed' && !iv.mine;
  const canCancel = iv.status === 'proposed' && iv.mine;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <ModeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">
            {formatDateCasablanca(new Date(iv.scheduledAt), locale)}
          </span>
          <span className="text-xs text-muted-foreground">· {t(`interviews.mode_${iv.mode}`)}</span>
        </div>
        {iv.location && (
          <p className="truncate text-xs text-muted-foreground">{iv.location}</p>
        )}
        {iv.note && <p className="truncate text-xs italic text-muted-foreground">{iv.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={STATUS_VARIANT[iv.status]}>{t(`interviews.status_${iv.status}`)}</Badge>
        {canRespond && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t('interviews.accept')}
              title={t('interviews.accept')}
              disabled={pending}
              onClick={() => onRespond(iv.id, 'accepted')}
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t('interviews.decline')}
              title={t('interviews.decline')}
              disabled={pending}
              onClick={() => onRespond(iv.id, 'declined')}
            >
              <X className="size-3.5" />
            </Button>
          </>
        )}
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={pending}
            onClick={() => onRespond(iv.id, 'cancelled')}
          >
            {t('interviews.cancelProposal')}
          </Button>
        )}
      </div>
    </div>
  );
}
