'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  BarChart3,
  Search,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/i18n/locale-context';

// Below-the-fold on first paint — deferred so it never competes with
// the hero for the initial bundle/LCP.
const TrustSection = dynamic(() =>
  import('@/components/TrustSection').then((m) => m.TrustSection),
);

export default function HomePage() {
  const { t } = useLocale();

  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
            <div className="absolute top-0 start-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <Sparkles className="size-3" />
                {t('hero.badge')}
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t('hero.title')}{' '}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {t('hero.titleHighlight')}
                </span>
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {t('hero.subtitle')}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="gap-2 text-base">
                    {t('hero.cta')}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>

              <div className="mt-16 grid grid-cols-3 gap-8 border-t border-border/50 pt-8">
                <StatItem value={t('hero.stat1Value')} label={t('hero.stat1Label')} />
                <StatItem value={t('hero.stat2Value')} label={t('hero.stat2Label')} />
                <StatItem value={t('hero.stat3Value')} label={t('hero.stat3Label')} />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border/50 bg-muted/30 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('features.title')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('features.subtitle')}
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2">
              <FeatureCard
                icon={BarChart3}
                title={t('features.scoring.title')}
                description={t('features.scoring.description')}
              />
              <FeatureCard
                icon={Search}
                title={t('features.cvtheque.title')}
                description={t('features.cvtheque.description')}
              />
              <FeatureCard
                icon={MessageSquare}
                title={t('features.messaging.title')}
                description={t('features.messaging.description')}
              />
              <FeatureCard
                icon={ShieldCheck}
                title={t('features.compliance.title')}
                description={t('features.compliance.description')}
              />
            </div>
          </div>
        </section>

        {/* Trust */}
        <TrustSection
          title={t('trust.title')}
          sectorLabels={{
            tech: t('trust.sectors.tech'),
            finance: t('trust.sectors.finance'),
            retail: t('trust.sectors.retail'),
            health: t('trust.sectors.health'),
            industry: t('trust.sectors.industry'),
            education: t('trust.sectors.education'),
          }}
        />
      </main>

      <Footer />
    </>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold text-foreground sm:text-3xl">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/50 bg-card p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
