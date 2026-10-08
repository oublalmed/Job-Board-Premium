'use client';

import { useState, type FormEvent } from 'react';
import {
  Briefcase,
  GraduationCap,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useExperiences,
  useAddExperience,
  useDeleteExperience,
  type ExperienceType,
} from './queries';

const EMPTY = {
  type: 'work' as ExperienceType,
  title: '',
  organization: '',
  startDate: '',
  endDate: '',
  description: '',
};

// >= 1 experience OR formation counts 20 pts toward completeness.
export function ExperienceCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);

  const list = useExperiences();
  const add = useAddExperience();
  const remove = useDeleteExperience();

  const items = list.data ?? [];
  const canSubmit =
    form.title.trim() && form.organization.trim() && form.startDate;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    add.mutate(
      {
        type: form.type,
        title: form.title.trim(),
        organization: form.organization.trim(),
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          toast(t('profile.saved'), 'success');
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Briefcase className="size-4 text-primary" />
            {t('profile.experiences.title')}
          </span>
          {items.length >= 1 && (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" />
              {t('profile.experiences.count', { n: String(items.length) })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t('profile.experiences.subtitle')}
        </p>

        {/* existing items */}
        {list.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('profile.experiences.empty')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60">
            {items.map((x) => (
              <li key={x.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {x.type === 'education' ? (
                    <GraduationCap className="size-4.5" />
                  ) : (
                    <Briefcase className="size-4.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{x.title}</p>
                  <p className="text-sm text-muted-foreground">{x.organization}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {x.startDate?.slice(0, 7)} —{' '}
                    {x.endDate ? x.endDate.slice(0, 7) : t('profile.experiences.present')}
                  </p>
                  {x.description && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{x.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => remove.mutate(x.id, { onError: () => toast(t('common.error'), 'error') })}
                  disabled={remove.isPending}
                  aria-label={t('common.delete')}
                >
                  {remove.isPending && remove.variables === x.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* add form */}
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t('profile.experiences.typeLabel')}</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ExperienceType }))}
            >
              <option value="work">{t('profile.experiences.typeWork')}</option>
              <option value="education">{t('profile.experiences.typeEducation')}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('profile.experiences.titleField')}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('profile.experiences.titlePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('profile.experiences.organization')}</Label>
            <Input
              value={form.organization}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              placeholder={t('profile.experiences.organizationPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('profile.experiences.startDate')}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('profile.experiences.endDate')}</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t('profile.experiences.description')}</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('profile.experiences.descriptionPlaceholder')}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!canSubmit || add.isPending} className="gap-2">
              {add.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {t('profile.experiences.add')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
