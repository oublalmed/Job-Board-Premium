'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import {
  LayoutDashboard,
  User,
  Briefcase,
  Search,
  Heart,
  MessageSquare,
  Settings,
  Bell,
  Building2,
  CreditCard,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { useAuth, type Role } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { cn } from '@/lib/utils';

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  const links: SidebarLink[] = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/profile', label: t('nav.profile'), icon: User },
    { href: '/jobs', label: t('nav.jobs'), icon: Briefcase, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/candidates', label: t('nav.candidates'), icon: Search, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/shortlist', label: t('nav.shortlist'), icon: Heart, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/company', label: t('nav.company'), icon: Building2, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/subscription', label: t('nav.subscription'), icon: CreditCard, roles: ['recruiter', 'company_admin'] },
    { href: '/assessments', label: t('assessments.title'), icon: ClipboardList, roles: ['candidate'] },
    {
      href: '/admin/school-verifications',
      label: t('admin.schoolVerifications.navLabel'),
      icon: GraduationCap,
      roles: ['admin', 'moderator'],
    },
    { href: '/messages', label: t('nav.messages'), icon: MessageSquare },
    { href: '/notifications', label: t('nav.notifications'), icon: Bell },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  const userRoles = user?.roles ?? [];
  const filteredLinks = links.filter(
    (link) => !link.roles || link.roles.some((r) => userRoles.includes(r)),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground lg:hidden"
        aria-label={t('nav.label')}
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={close}
          />
          <aside className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-background shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-sm font-bold text-foreground">{t('app.name')}</span>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={t('common.close')}
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {filteredLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
