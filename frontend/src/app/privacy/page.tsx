import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Politique de confidentialité — ${APP_NAME}`,
};

// ENF-12 — placeholder privacy policy the registration consent links to.
// Content is intentionally minimal scaffolding for the legal team to replace;
// the point is that consent references a real, reachable document.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-foreground">
        Politique de confidentialité
      </h1>
      <p className="text-sm text-muted-foreground">
        {APP_NAME} traite vos données personnelles conformément à la loi
        marocaine 09-08 (CNDP) et aux principes du RGPD. Cette page est un
        gabarit à compléter par l&apos;équipe juridique avant la mise en
        production.
      </p>
      <section className="flex flex-col gap-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">
          Données collectées et finalités
        </h2>
        <p>
          Compte (email), profil candidat, documents (CV/diplômes), résultats
          d&apos;évaluation, et données de facturation pour les recruteurs.
          Elles servent à fournir le service d&apos;évaluation et de mise en
          relation.
        </p>
        <h2 className="text-base font-semibold text-foreground">Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de portabilité et
          d&apos;effacement, exerçables depuis votre profil (export et
          suppression de compte), traités sous 30 jours.
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Conservation
        </h2>
        <p>
          Les factures sont conservées 10 ans (obligation légale). Les autres
          données sont supprimées à la clôture du compte, sous réserve des
          obligations légales applicables.
        </p>
      </section>
      <Link
        href="/register"
        className="text-sm font-medium text-primary hover:underline underline-offset-4"
      >
        ← Retour à l&apos;inscription
      </Link>
    </main>
  );
}
