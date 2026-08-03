'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Plus, FileText } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { components } from '@/api/schema';

type JobOffer = components['schemas']['JobOffer'];

export default function OffersPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void loadOffers();
  }, []);

  async function loadOffers() {
    setLoading(true);
    try {
      const { data } = await apiClient.GET('/api/v1/companies/offers');
      if (data) {
        setOffers(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(id: string) {
    if (!confirm(t('offers.closeConfirm'))) return;
    const { error } = await apiClient.PATCH('/api/v1/companies/offers/{id}/close', {
      params: { path: { id } },
    });
    if (error) {
      toast(t('common.error'), 'error');
      return;
    }
    toast(t('offers.closed'), 'success');
    void loadOffers();
  }

  function statusVariant(status: string) {
    switch (status) {
      case 'published':
        return 'success' as const;
      case 'pending_moderation':
        return 'warning' as const;
      case 'rejected':
        return 'destructive' as const;
      case 'closed':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('offers.title')}</h1>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          {t('offers.create')}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        )}

        {!loading &&
          offers.map((offer) => (
            <Card key={offer.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{offer.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(offer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(offer.status)}>
                    {t(`offers.status.${offer.status}`)}
                  </Badge>
                  {offer.status === 'published' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleClose(offer.id)}
                    >
                      {t('offers.close')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

        {!loading && offers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('offers.noOffers')}</p>
          </div>
        )}
      </div>

      <CreateOfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void loadOffers()}
      />
    </div>
  );
}

function CreateOfferDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (description.trim()) body.description = description.trim();

      const { error } = await apiClient.POST('/api/v1/companies/offers', {
        body: body as never,
      });
      if (error) {
        toast(t('offers.createError'), 'error');
        return;
      }
      toast(t('offers.created'), 'success');
      setTitle('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{t('offers.createTitle')}</DialogTitle>
          <DialogDescription>{t('offers.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="offer-title">{t('offers.offerTitle')}</Label>
            <Input
              id="offer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('offers.offerTitlePlaceholder')}
              required
              minLength={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="offer-desc">{t('offers.offerDescription')}</Label>
            <Textarea
              id="offer-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('offers.offerDescriptionPlaceholder')}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('offers.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || title.trim().length < 3}>
              {submitting ? t('offers.submitting') : t('offers.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
