'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  User,
  Briefcase,
  Search,
  Heart,
  MessageSquare,
  Settings,
  FileText,
  Bell,
  Building2,
  CreditCard,
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

export function DashboardSidebar() {
  const { user } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();

  const links: SidebarLink[] = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/profile', label: t('nav.profile'), icon: User },
    { href: '/jobs', label: t('nav.jobs'), icon: Briefcase, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/candidates', label: t('nav.candidates'), icon: Search, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/offers', label: t('nav.offers'), icon: FileText, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/shortlist', label: t('nav.shortlist'), icon: Heart, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/company', label: t('nav.company'), icon: Building2, roles: ['recruiter', 'company_admin', 'admin'] },
    { href: '/subscription', label: t('nav.subscription'), icon: CreditCard, roles: ['recruiter', 'company_admin'] },
    { href: '/messages', label: t('nav.messages'), icon: MessageSquare },
    { href: '/notifications', label: t('nav.notifications'), icon: Bell },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  const userRoles = user?.roles ?? [];

  const filteredLinks = links.filter(
    (link) => !link.roles || link.roles.some((r) => userRoles.includes(r)),
  );

  return (
    <aside className="hidden w-64 shrink-0 border-e border-border/50 bg-muted/20 lg:block">
      <nav className="flex flex-col gap-1 p-4" aria-label={t('nav.label')}>
        {filteredLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
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
  );
}
