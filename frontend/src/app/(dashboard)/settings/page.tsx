'use client';

import { Settings } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useLocale();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">{t('nav.settings')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personalInfo')}</CardTitle>
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
    </div>
  );
}
