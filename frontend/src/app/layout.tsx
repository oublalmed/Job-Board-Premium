import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { APP_NAME } from '@/lib/brand';
import './globals.css';

// Loaded once here and exposed as a CSS variable on <html> (server-
// rendered, no hydration gap) — globals.css reads --font-geist as the
// single app font. Self-hosted by next/font at build time (no external
// request, no layout shift from a late web-font swap).
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Recrutement au Maroc`,
  description:
    'Plateforme de recrutement premium au Maroc. Évaluation technique, scoring intelligent et mise en relation directe.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning className={geist.variable}>
      <body className="min-h-dvh flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
