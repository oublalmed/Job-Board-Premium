import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { APP_NAME } from '@/lib/brand';
import './globals.css';

// ENF-14 — set <html lang/dir> from the stored locale BEFORE first paint, so a
// non-default (e.g. RTL) locale never flashes the default LTR French first.
// Runs as a beforeInteractive script (hoisted to <head> by Next); mirrors the
// locale-context storage key and RTL set, and is defensive against blocked
// storage. `document.documentElement.lang` is still kept in sync at runtime by
// the locale context when the user switches language in-session.
const LOCALE_NO_FLASH = `(function(){try{var l=localStorage.getItem('talentiq_locale');if(!l)return;var rtl={ar:1,he:1,fa:1,ur:1};var e=document.documentElement;e.lang=l;e.dir=rtl[l]?'rtl':'ltr';}catch(e){}})();`;

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
        <Script id="locale-no-flash" strategy="beforeInteractive">
          {LOCALE_NO_FLASH}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
