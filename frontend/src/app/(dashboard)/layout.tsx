'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { MobileSidebar } from '@/components/MobileSidebar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!user) return null;

  // One theme decision, made once, at the root of the whole
  // authenticated shell — not per route-group. Shared routes
  // (/dashboard, /profile, /messages...) are visited by both roles
  // under the exact same page.tsx, so the theme can't be tied to
  // routing structure; it has to follow who's actually logged in.
  // Recruiter/company_admin/admin win over candidate if a user
  // somehow holds both (administrative context takes precedence).
  const isRecruiter = user.roles.some((r) =>
    ['recruiter', 'company_admin', 'admin'].includes(r),
  );
  const theme = isRecruiter ? 'recruiter' : 'candidate';

  return (
    // font-sans is re-declared here deliberately, not left to inherit
    // from <body>: body's own font-family (globals.css @layer base) is
    // computed once at the body element using :root's tokens and that
    // computed value is what descendants inherit — a data-theme
    // override on a nested div changes --app-font-sans for elements
    // inside it, but does nothing for font-family unless something
    // inside that scope re-declares the property so it gets
    // re-resolved against the local (overridden) custom property.
    // Found by checking computed styles after the fact, not assumed.
    <div data-theme={theme} className="contents font-sans">
      <Navbar />
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="mb-4 lg:hidden">
              <MobileSidebar />
            </div>
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
