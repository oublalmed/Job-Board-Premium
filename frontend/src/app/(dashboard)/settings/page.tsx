'use client';

import { UserCog, Mail, Shield, Download, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDeleteAccount, useExportData } from '@/features/settings/queries';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();

  const isCandidate = user?.roles.includes('candidate');

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: () => toast(t('settings.exported'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function handleDelete() {
    if (!confirm(t('settings.deleteConfirm'))) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast(t('settings.deleted'), 'success');
        logout();
      },
      onError: () => toast(t('settings.deleteError'), 'error'),
    });
  }

  if (!user) return null;

  return (
    <motion.div className="flex flex-col gap-8" {...fadeUp}>
      <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            {t('settings.account')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                {t('profile.email')}
              </Label>
              <Input value={user.email} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('dashboard.roles', { roles: '' })}</Label>
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isCandidate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              {t('settings.data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t('settings.exportData')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('settings.exportDataDescription')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={handleExport}
                disabled={exportData.isPending}
              >
                {exportData.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exportData.isPending ? t('settings.exporting') : t('settings.exportData')}
              </Button>
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-5">
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
                  onClick={handleDelete}
                  disabled={deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {deleteAccount.isPending ? t('common.loading') : t('settings.deleteAccount')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
