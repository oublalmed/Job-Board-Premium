import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    'text-sm text-muted-foreground transition-colors hover:text-foreground',
    isActive && 'font-medium text-foreground',
  );
}

// The one shell every route renders inside — header (brand, nav,
// language switcher, session control) + a centered container feeding
// <Outlet />. Nav links switch on auth state only; which *role-scoped*
// links appear (candidate/recruiter/admin) is decided by the business
// flows that land on top of this in Front 1+, not by this commit.
export function AppShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('layout.skipToContent')}
      </a>

      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
          <NavLink to="/" className="text-lg font-semibold text-foreground">
            {t('app.name')}
          </NavLink>

          <nav
            aria-label={t('nav.label')}
            className="flex flex-wrap items-center gap-4"
          >
            {user ? (
              <NavLink to="/dashboard" className={navLinkClassName}>
                {t('nav.dashboard')}
              </NavLink>
            ) : (
              <>
                <NavLink to="/login" className={navLinkClassName}>
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/register" className={navLinkClassName}>
                  {t('nav.register')}
                </NavLink>
              </>
            )}
            <NavLink to="/design-system" className={navLinkClassName}>
              {t('nav.designSystem')}
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={logout}
              >
                {t('auth.logout')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6"
      >
        <Outlet />
      </main>
    </div>
  );
}
