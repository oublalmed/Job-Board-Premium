'use client';

import { useState, useEffect } from 'react';
import { User, MapPin, Upload, Trash2, Save } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [completeness, setCompleteness] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    void loadProfile();
    void loadCompleteness();
  }, []);

  async function loadProfile() {
    const { data } = await apiClient.GET('/api/v1/candidates/profile');
    if (data) {
      setProfile(data as Record<string, unknown>);
      setFirstName((data as Record<string, unknown>).firstName as string ?? '');
      setLastName((data as Record<string, unknown>).lastName as string ?? '');
      setHeadline((data as Record<string, unknown>).headline as string ?? '');
      setLocation((data as Record<string, unknown>).location as string ?? '');
    }
  }

  async function loadCompleteness() {
    const { data } = await apiClient.GET('/api/v1/candidates/profile/completeness');
    if (data) {
      setCompleteness((data as Record<string, unknown>).completeness as number);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.PUT('/api/v1/candidates/profile', {
        body: { firstName, lastName, headline, location } as never,
      });
      await loadCompleteness();
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
          {completeness !== null && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t('profile.completeness')}</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(completeness, 100)}%` }}
                  />
                </div>
                <Badge variant={completeness >= 70 ? 'success' : 'warning'}>
                  {completeness}%
                </Badge>
              </div>
            </div>
          )}
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="size-4" />
          {saving ? t('profile.saving') : t('profile.save')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar card */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
              <User className="size-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : user.email}
              </p>
              {headline && (
                <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
              )}
              {location && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {location}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('profile.personalInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">{t('profile.firstName')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">{t('profile.lastName')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">{t('profile.location')}</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t('profile.email')}</Label>
                <Input id="email" value={user.email} disabled />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CV Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.cv')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="gap-2">
              <Upload className="size-4" />
              {t('profile.uploadCv')}
            </Button>
            <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              {t('profile.deleteCv')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
