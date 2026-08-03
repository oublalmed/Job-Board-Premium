'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Bell } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDashboard =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/candidates') ||
    pathname.startsWith('/offers') ||
    pathname.startsWith('/shortlist') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/company') ||
    pathname.startsWith('/subscription') ||
    pathname.startsWith('/assessments') ||
    pathname.startsWith('/settings');

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href={user ? '/dashboard' : '/'}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            JB
          </div>
          <span className="hidden sm:inline">{t('app.name')}</span>
        </Link>

        {!isDashboard && (
          <nav
            aria-label={t('nav.label')}
            className="hidden items-center gap-1 md:flex"
          >
            <NavLink href="/#features" label={t('features.title')} active={false} />
            <NavLink href="/#pricing" label={t('nav.pricing')} active={false} />
          </nav>
        )}

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="size-4" />
                </Button>
              </Link>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t('auth.logout')}
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t('nav.login')}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">{t('nav.register')}</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {user ? (
              <>
                <MobileLink href="/dashboard" label={t('nav.dashboard')} onClick={() => setMobileOpen(false)} />
                <MobileLink href="/profile" label={t('nav.profile')} onClick={() => setMobileOpen(false)} />
                <MobileLink href="/messages" label={t('nav.messages')} onClick={() => setMobileOpen(false)} />
              </>
            ) : (
              <>
                <MobileLink href="/login" label={t('nav.login')} onClick={() => setMobileOpen(false)} />
                <MobileLink href="/register" label={t('nav.register')} onClick={() => setMobileOpen(false)} />
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
    >
      {label}
    </Link>
  );
}

function MobileLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
    >
      {label}
    </Link>
  );
}
