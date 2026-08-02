import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder only — proves RequireAuth + the login flow work end to
// end (login → token → this page). Session control (logout) lives in
// <AppShell />'s header, not here. Replaced by real per-role dashboards
// once the candidate/recruiter/admin flows land.
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.dashboard.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>{t('auth.dashboard.welcome', { email: user?.email })}</p>
        <p className="text-sm text-muted-foreground">
          {t('auth.dashboard.roles', { roles: user?.roles.join(', ') })}
        </p>
      </CardContent>
    </Card>
  );
}
