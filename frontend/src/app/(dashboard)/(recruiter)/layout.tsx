import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/brand';

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
  return children;
}
