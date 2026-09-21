'use client';

import { useState } from 'react';
import { ShieldQuestion, Send, Loader2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMyDataRequests,
  useCreateDataRequest,
  DataRequestConflictError,
  type DataRequestType,
  type DataRequestStatus,
} from './queries';

const REQUEST_TYPES: DataRequestType[] = [
  'access',
  'portability',
  'erasure',
  'rectification',
  'objection',
];

// A type is blocked while a prior request of the same type is still open.
const OPEN_STATUSES: DataRequestStatus[] = ['pending', 'in_progress'];

// Defined at module scope (not in render) so the impure Date.now() call does
// not violate the React Compiler purity rule — same pattern as the admin
// data-requests queue.
function isOverdue(status: DataRequestStatus, dueAt: string): boolean {
  return (
    OPEN_STATUSES.includes(status) && new Date(dueAt).getTime() < Date.now()
  );
}

const STATUS_VARIANT: Record<
  DataRequestStatus,
  'warning' | 'secondary' | 'success' | 'destructive'
> = {
  pending: 'warning',
  in_progress: 'secondary',
  completed: 'success',
  rejected: 'destructive',
};

// EF-ADM-03 (candidate side) — lets a candidate file a CNDP/RGPD data-subject
// request and see the status + legal deadline of their own requests.
export function DataRequestsCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useMyDataRequests();
  const createRequest = useCreateDataRequest();

  const [type, setType] = useState<DataRequestType>('access');
  const [message, setMessage] = useState('');

  const requests = data ?? [];
  const openTypes = new Set(
    requests
      .filter((r) => OPEN_STATUSES.includes(r.status))
      .map((r) => r.type),
  );
  const currentTypeBlocked = openTypes.has(type);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentTypeBlocked) return;
    createRequest.mutate(
      { type, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast(t('dataRequestsCandidate.filed'), 'success');
          setMessage('');
        },
        onError: (err) => {
          if (err instanceof DataRequestConflictError) {
            toast(t('dataRequestsCandidate.conflict'), 'error');
          } else {
            toast(t('common.error'), 'error');
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldQuestion className="size-5 text-primary" />
          {t('dataRequestsCandidate.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {t('dataRequestsCandidate.description')}
        </p>

        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dataRequestsCandidate.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((req) => {
              const overdue = isOverdue(req.status, req.dueAt);
              return (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t(`dataRequestsCandidate.type.${req.type}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('dataRequestsCandidate.due')}:{' '}
                      {new Date(req.dueAt).toLocaleDateString()}
                      {overdue && (
                        <span className="ms-1 text-destructive">
                          ({t('dataRequestsCandidate.overdue')})
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[req.status]}>
                    {t(`dataRequestsCandidate.status.${req.status}`)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 border-t border-border/60 pt-4"
        >
          <p className="text-sm font-medium text-foreground">
            {t('dataRequestsCandidate.fileTitle')}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dr-type">{t('dataRequestsCandidate.type.label')}</Label>
            <Select
              id="dr-type"
              value={type}
              onChange={(e) => setType(e.target.value as DataRequestType)}
            >
              {REQUEST_TYPES.map((rt) => (
                <option key={rt} value={rt} disabled={openTypes.has(rt)}>
                  {t(`dataRequestsCandidate.type.${rt}`)}
                  {openTypes.has(rt)
                    ? ` (${t('dataRequestsCandidate.openTag')})`
                    : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dr-message">
              {t('dataRequestsCandidate.message')}
            </Label>
            <Textarea
              id="dr-message"
              rows={3}
              maxLength={2000}
              placeholder={t('dataRequestsCandidate.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {currentTypeBlocked && (
            <p className="text-xs text-destructive">
              {t('dataRequestsCandidate.conflict')}
            </p>
          )}
          <div>
            <Button
              type="submit"
              disabled={createRequest.isPending || currentTypeBlocked}
              className="gap-2"
            >
              {createRequest.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {t('dataRequestsCandidate.file')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
