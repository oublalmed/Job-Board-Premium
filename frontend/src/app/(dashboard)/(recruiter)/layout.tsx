import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/brand';
import { RecruiterAccessBar } from '@/features/billing/RecruiterAccessBar';

// Server Component (no 'use client') so it can export per-section
// metadata. No theming here — the app uses a single unified Cobalt theme.
export const metadata: Metadata = {
  title: {
    template: `%s — Espace recruteur | ${APP_NAME}`,
    default: `Espace recruteur | ${APP_NAME}`,
  },
};

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* EF-BILL-04 / EF-RECR-05 — subscription-restriction notice and contact
          quota, surfaced on every recruiter page. */}
      <RecruiterAccessBar />
      {children}
    </>
  );
}
