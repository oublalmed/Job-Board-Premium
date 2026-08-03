'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/auth-context';
import { LocaleProvider } from '@/i18n/locale-context';
import '@/auth/api-middleware';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <AuthProvider>{children}</AuthProvider>
    </LocaleProvider>
  );
}
