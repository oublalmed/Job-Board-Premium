'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSkillCatalog,
  useProfileSkills,
  useAddSkill,
  useRemoveSkill,
} from './queries';

// Skills count 20 pts toward completeness once >= 5 are attached. Skills come
// from a fixed referential (the catalog), so this is a type-ahead picker, not a
// free-text field.
const MIN_SKILLS = 5;

export function SkillsCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [query, setQuery] = useState('');

  const catalog = useSkillCatalog();
  const mine = useProfileSkills();
  const addSkill = useAddSkill();
  const removeSkill = useRemoveSkill();

  const attached = mine.data ?? [];
  const attachedIds = new Set(attached.map((s) => s.skillId));

  // Catalog entries not yet attached, filtered by the search query.
  const suggestions = useMemo(() => {
    const items = (catalog.data ?? []).filter((c) => !attachedIds.has(c.id));
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((c) => c.name.toLowerCase().includes(q))
      : items;
    return filtered.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data, query, attached]);

  function handleAdd(skillId: string) {
    addSkill.mutate(skillId, {
      onSuccess: () => {
        setQuery('');
        toast(t('profile.saved'), 'success');
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleRemove(id: string) {
    removeSkill.mutate(id, {
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const count = attached.length;
  const reached = count >= MIN_SKILLS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t('profile.skills.title')}
          </span>
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              reached ? 'text-success' : 'text-muted-foreground'
            }`}
          >
            {reached && <CheckCircle2 className="size-3.5" />}
            {t('profile.skills.count', { n: String(count), min: String(MIN_SKILLS) })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('profile.skills.subtitle')}</p>

        {/* search + add */}
        <div className="flex flex-col gap-2">
          <Input
            list="skill-catalog"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('profile.skills.placeholder')}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const match = (catalog.data ?? []).find(
                (c) =>
                  c.name.toLowerCase() === query.trim().toLowerCase() &&
                  !attachedIds.has(c.id),
              );
              if (match) handleAdd(match.id);
            }}
          />
          <datalist id="skill-catalog">
            {(catalog.data ?? [])
              .filter((c) => !attachedIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.name} />
              ))}
          </datalist>

          {query.trim() && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleAdd(s.id)}
                  disabled={addSkill.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Plus className="size-3" />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* attached */}
        {mine.isLoading ? (
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ) : attached.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('profile.skills.empty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attached.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 ps-3 pe-1.5 text-sm font-medium text-primary"
              >
                {s.name}
                <button
                  type="button"
                  aria-label={`${t('common.delete')} ${s.name}`}
                  onClick={() => handleRemove(s.id)}
                  disabled={removeSkill.isPending}
                  className="flex size-5 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                >
                  {removeSkill.isPending && removeSkill.variables === s.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
