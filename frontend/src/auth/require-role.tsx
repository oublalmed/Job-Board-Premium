import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { useAuth, type Role } from './auth-context';

interface RequireRoleProps {
  roles: Role[];
}

// RBAC route guard — nest under <RequireAuth /> (so `user` is guaranteed
// non-null here in practice); this only decides *which* authenticated
// users may proceed, not *whether* they're authenticated at all. Real
// enforcement stays server-side (every backend endpoint already checks
// roles independently) — this only prevents an authenticated-but-wrong-
// role user from seeing a screen meant for another persona, a UX
// guard, not the security boundary.
export function RequireRole({ roles }: RequireRoleProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const isAllowed = user?.roles.some((role) => roles.includes(role)) ?? false;

  if (!isAllowed) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p role="alert" className="text-destructive">
          {t('auth.guard.forbidden')}
        </p>
      </div>
    );
  }

  return <Outlet />;
}
