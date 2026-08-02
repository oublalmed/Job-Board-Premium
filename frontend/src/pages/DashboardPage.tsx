import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder only — proves RequireAuth + the login flow work end to end
// (login → token → this page). Replaced by real per-role dashboards in a
// later, business-flow lot; the real layout shell (header, nav) lands in
// the next commit and will wrap this instead of it standing alone.
export function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-svh flex-col items-center gap-6 bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('auth.dashboard.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>{t('auth.dashboard.welcome', { email: user?.email })}</p>
          <p className="text-sm text-muted-foreground">
            {t('auth.dashboard.roles', { roles: user?.roles.join(', ') })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            className="mt-4"
          >
            {t('auth.logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
