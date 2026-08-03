import type { Metadata } from 'next';
import { Geist, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

// Loaded once here and exposed as CSS variables on <html> (server-
// rendered, no hydration gap) — globals.css reads --font-geist as the
// base app font everywhere, and [data-theme="candidate"] swaps to
// --font-jakarta for a warmer, rounder feel on candidate-facing
// screens. Self-hosted by next/font at build time (no external
// request, no layout shift from a late web-font swap).
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Talentiq — Recrutement au Maroc',
  description:
    'Plateforme de recrutement premium au Maroc. Évaluation technique, scoring intelligent et mise en relation directe.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      dir="ltr"
      suppressHydrationWarning
      className={`${geist.variable} ${jakarta.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
