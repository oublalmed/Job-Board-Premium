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

  return (
    <>
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
    </>
  );
}
