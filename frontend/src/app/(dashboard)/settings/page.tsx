'use client';

import { useState } from 'react';
import { Settings, Download, Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCandidate = user?.roles.includes('candidate');

  async function handleExport() {
    setExporting(true);
    try {
      const { error } = await apiClient.GET('/api/v1/candidates/data/export');
      if (error) {
        toast(t('common.error'), 'error');
        return;
      }
      toast(t('settings.exported'), 'success');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('settings.deleteConfirm'))) return;
    setDeleting(true);
    try {
      const { error } = await apiClient.DELETE('/api/v1/candidates/data');
      if (error) {
        toast(t('settings.deleteError'), 'error');
        return;
      }
      toast(t('settings.deleted'), 'success');
      logout();
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t('profile.email')}</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('dashboard.roles', { roles: '' })}</Label>
              <Input value={user.roles.join(', ')} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {isCandidate && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.data')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('settings.exportData')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('settings.exportDataDescription')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? t('settings.exporting') : t('settings.exportData')}
              </Button>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {t('settings.deleteAccount')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('settings.deleteAccountDescription')}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {deleting ? t('common.loading') : t('settings.deleteAccount')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
