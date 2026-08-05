'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/auth-context';
import { LocaleProvider } from '@/i18n/locale-context';
import { ToastProvider } from '@/components/ui/toast';
import { makeQueryClient } from '@/lib/query-client';
import '@/auth/api-middleware';

export function Providers({ children }: { children: ReactNode }) {
  // Held in state (not module scope) so each browser session gets one
  // stable client, and Fast Refresh / suspense re-renders don't spawn a
  // second one. Server never renders this — it's a 'use client' island.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
