import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Contact — ${APP_NAME}`,
};

// The footer links here; scaffolding for the team to replace with real
// support channels before production, so the link is real and reachable.
export default function ContactPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-foreground">Contact</h1>
      <p className="text-sm text-muted-foreground">
        Une question sur {APP_NAME} ? Notre équipe est là pour vous aider.
      </p>
      <section className="flex flex-col gap-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Support</h2>
        <p>
          Écrivez-nous à{' '}
          <a
            href="mailto:support@cobalt.ma"
            className="text-primary hover:underline underline-offset-4"
          >
            support@cobalt.ma
          </a>{' '}
          — nous répondons sous 48 heures ouvrées.
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Protection des données (CNDP)
        </h2>
        <p>
          Pour toute demande relative à vos données personnelles, utilisez la
          section « Données personnelles » de vos{' '}
          <Link
            href="/settings"
            className="text-primary hover:underline underline-offset-4"
          >
            paramètres
          </Link>{' '}
          ou écrivez à{' '}
          <a
            href="mailto:privacy@cobalt.ma"
            className="text-primary hover:underline underline-offset-4"
          >
            privacy@cobalt.ma
          </a>
          .
        </p>
      </section>
      <Link
        href="/"
        className="text-sm font-medium text-primary hover:underline underline-offset-4"
      >
        ← {APP_NAME}
      </Link>
    </main>
  );
}
