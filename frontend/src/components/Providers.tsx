'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/auth-context';
import { LocaleProvider } from '@/i18n/locale-context';
import { ToastProvider } from '@/components/ui/toast';
import '@/auth/api-middleware';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
