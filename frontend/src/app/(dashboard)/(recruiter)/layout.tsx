import type { Metadata } from 'next';

// Server Component (no 'use client') — the group boundary doesn't
// need client interactivity itself, and being a Server Component is
// what lets it export metadata (a 'use client' file can't). The
// data-theme itself is applied once, higher up, at the shared
// (dashboard)/layout.tsx based on the logged-in user's role — not
// here — since shared routes (/dashboard, /profile...) are visited by
// both roles under the same page.tsx and can't be themed by which
// route-group folder a file happens to live in. This group exists for
// per-section metadata/loading.tsx, not for the theme mechanism.
export const metadata: Metadata = {
  title: {
    template: '%s — Espace recruteur | Job Board Premium',
    default: 'Espace recruteur | Job Board Premium',
  },
};

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
