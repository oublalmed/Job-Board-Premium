import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/brand';

// Server Component for per-section metadata. Single unified Cobalt theme.
export const metadata: Metadata = {
  title: {
    template: `%s — Espace candidat | ${APP_NAME}`,
    default: `Espace candidat | ${APP_NAME}`,
  },
};

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
