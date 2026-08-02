import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

// Redirect-if-unauthenticated, the literal requirement: no user after the
// silent-restore attempt finished → bounce to /login, remembering where
// the user was trying to go (state.from) so the login page can send them
// back there instead of always landing on a fixed default route.
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
