import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Conditions d'utilisation — ${APP_NAME}`,
};

// The footer links here; content is intentionally minimal scaffolding for the
// legal team to replace before production, so the link is real and reachable.
export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-foreground">
        Conditions d&apos;utilisation
      </h1>
      <p className="text-sm text-muted-foreground">
        Ces conditions régissent l&apos;utilisation de la plateforme {APP_NAME}.
        Cette page est un gabarit à compléter par l&apos;équipe juridique avant
        la mise en production.
      </p>
      <section className="flex flex-col gap-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Objet</h2>
        <p>
          {APP_NAME} met en relation des candidats évalués et des recruteurs via
          une évaluation technique, un scoring normalisé et une messagerie
          encadrée par des quotas d&apos;abonnement.
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Compte et éligibilité
        </h2>
        <p>
          La création d&apos;un compte requiert une adresse email valide et
          l&apos;acceptation de la politique de confidentialité. Vous êtes
          responsable de la confidentialité de vos identifiants.
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Usage acceptable
        </h2>
        <p>
          Toute tentative de fraude à l&apos;évaluation, de contournement des
          quotas ou d&apos;abus de la messagerie peut entraîner la suspension du
          compte.
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Données personnelles
        </h2>
        <p>
          Le traitement de vos données est décrit dans la{' '}
          <Link
            href="/privacy"
            className="text-primary hover:underline underline-offset-4"
          >
            politique de confidentialité
          </Link>
          , conforme à la loi 09-08 (CNDP) et aux principes du RGPD.
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
