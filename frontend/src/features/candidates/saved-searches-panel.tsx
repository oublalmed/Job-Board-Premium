'use client';

import { useState } from 'react';
import { Bookmark, BookmarkPlus, Bell, BellOff, Trash2, Pencil, Loader2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { CandidateFilters } from './types';
import {
  useSavedSearches,
  useCreateSavedSearch,
  useUpdateSavedSearch,
  useDeleteSavedSearch,
  filtersToCriteria,
  criteriaToFilters,
  type SavedSearch,
} from './saved-searches';

interface SavedSearchesPanelProps {
  // The recruiter's current (draft) filters — what "Save this search" captures.
  currentFilters: CandidateFilters;
  // Re-apply a saved search's filters to the page + run the search.
  onApply: (filters: CandidateFilters) => void;
}

export function SavedSearchesPanel({
  currentFilters,
  onApply,
}: SavedSearchesPanelProps) {
  const { t } = useLocale();
  const { toast } = useToast();

  const list = useSavedSearches();
  const createMutation = useCreateSavedSearch();
  const updateMutation = useUpdateSavedSearch();
  const deleteMutation = useDeleteSavedSearch();

  // Dialog drives both "save new" (no id) and "rename" (with id).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavedSearch | null>(null);
  const [name, setName] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);

  function openSaveDialog() {
    setEditing(null);
    setName('');
    setAlertEnabled(false);
    setDialogOpen(true);
  }

  function openRenameDialog(s: SavedSearch) {
    setEditing(s);
    setName(s.name);
    setAlertEnabled(s.alertEnabled);
    setDialogOpen(true);
  }

  function submitDialog() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, name: trimmed, alertEnabled },
        {
          onSuccess: () => {
            toast(t('savedSearches.updated'), 'success');
            setDialogOpen(false);
          },
          onError: () => toast(t('common.error'), 'error'),
        },
      );
    } else {
      createMutation.mutate(
        {
          name: trimmed,
          criteria: filtersToCriteria(currentFilters),
          alertEnabled,
        },
        {
          onSuccess: () => {
            toast(t('savedSearches.saved'), 'success');
            setDialogOpen(false);
          },
          onError: () => toast(t('common.error'), 'error'),
        },
      );
    }
  }

  function toggleAlert(s: SavedSearch) {
    updateMutation.mutate(
      { id: s.id, alertEnabled: !s.alertEnabled },
      {
        onSuccess: () =>
          toast(
            s.alertEnabled
              ? t('savedSearches.alertsDisabled')
              : t('savedSearches.alertsEnabled'),
            'success',
          ),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast(t('savedSearches.deleted'), 'success');
        setPendingDelete(null);
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  const items = list.data ?? [];
  const dialogPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bookmark className="size-4 text-primary" />
            {t('savedSearches.title')}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openSaveDialog}
          >
            <BookmarkPlus className="size-3.5" />
            {t('savedSearches.saveThisSearch')}
          </Button>
        </div>

        {list.isLoading && (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        )}

        {!list.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t('savedSearches.empty')}
          </p>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
              >
                <button
                  type="button"
                  onClick={() => onApply(criteriaToFilters(s.criteria))}
                  className="min-w-0 flex-1 truncate text-start text-sm text-foreground hover:text-primary"
                  title={t('savedSearches.applyHint')}
                >
                  {s.name}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  aria-pressed={s.alertEnabled}
                  onClick={() => toggleAlert(s)}
                  title={
                    s.alertEnabled
                      ? t('savedSearches.alertsOn')
                      : t('savedSearches.alertsOff')
                  }
                >
                  {s.alertEnabled ? (
                    <Bell className="size-3.5 text-primary" />
                  ) : (
                    <BellOff className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="hidden sm:inline">
                    {s.alertEnabled
                      ? t('savedSearches.alertsOn')
                      : t('savedSearches.alertsOff')}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('savedSearches.rename')}
                  onClick={() => openRenameDialog(s)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('common.delete')}
                  onClick={() => setPendingDelete(s)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Save / rename dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('savedSearches.renameTitle')
                : t('savedSearches.saveTitle')}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t('savedSearches.renameDescription')
                : t('savedSearches.saveDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saved-search-name">
                {t('savedSearches.name')}
              </Label>
              <Input
                id="saved-search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDialog()}
                placeholder={t('savedSearches.namePlaceholder')}
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                checked={alertEnabled}
                onChange={(e) => setAlertEnabled(e.target.checked)}
              />
              {t('savedSearches.enableAlerts')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submitDialog}
              disabled={!name.trim() || dialogPending}
              className="gap-1.5"
            >
              {dialogPending && <Loader2 className="size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogClose onClose={() => setPendingDelete(null)} />
          <DialogHeader>
            <DialogTitle>{t('savedSearches.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('savedSearches.deleteConfirm', {
                name: pendingDelete?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
