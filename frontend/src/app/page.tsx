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
  Check,
  UserPlus,
  FileCheck2,
  Send,
  Star,
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
        {/* ─────────────── Hero ─────────────── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
            <div className="absolute top-[-10%] start-1/2 -translate-x-1/2 h-[560px] w-[900px] rounded-full bg-primary/10 blur-3xl" />
            {/* subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <Sparkles className="size-3" />
                {t('hero.badge')}
              </Badge>

              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t('hero.title')}{' '}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {t('hero.titleHighlight')}
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {t('hero.subtitle')}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="gap-2 text-base">
                    {t('hero.cta')}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
                <Link href="#pricing">
                  <Button size="lg" variant="outline" className="text-base">
                    {t('hero.ctaSecondary')}
                  </Button>
                </Link>
              </div>

              <div className="mx-auto mt-14 grid max-w-xl grid-cols-3 gap-8 border-t border-border/50 pt-8">
                <StatItem value={t('hero.stat1Value')} label={t('hero.stat1Label')} />
                <StatItem value={t('hero.stat2Value')} label={t('hero.stat2Label')} />
                <StatItem value={t('hero.stat3Value')} label={t('hero.stat3Label')} />
              </div>
            </div>

            {/* Product preview */}
            <div className="mx-auto mt-16 max-w-4xl">
              <ProductPreview t={t} />
            </div>
          </div>
        </section>

        {/* ─────────────── How it works ─────────────── */}
        <section id="how" className="border-t border-border/50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary" className="mb-4">
                {t('how.badge')}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('how.title')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t('how.subtitle')}</p>
            </div>

            <div className="relative mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-3">
              <StepCard
                step="1"
                icon={UserPlus}
                title={t('how.step1Title')}
                description={t('how.step1Desc')}
              />
              <StepCard
                step="2"
                icon={FileCheck2}
                title={t('how.step2Title')}
                description={t('how.step2Desc')}
              />
              <StepCard
                step="3"
                icon={Send}
                title={t('how.step3Title')}
                description={t('how.step3Desc')}
              />
            </div>
          </div>
        </section>

        {/* ─────────────── Audience (dual path) ─────────────── */}
        <section className="border-t border-border/50 bg-muted/30 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('audience.title')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('audience.subtitle')}
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-2">
              <AudienceCard
                label={t('audience.candidate.label')}
                title={t('audience.candidate.title')}
                bullets={[
                  t('audience.candidate.b1'),
                  t('audience.candidate.b2'),
                  t('audience.candidate.b3'),
                ]}
                ctaLabel={t('audience.candidate.cta')}
                ctaHref="/register"
                highlight
              />
              <AudienceCard
                label={t('audience.recruiter.label')}
                title={t('audience.recruiter.title')}
                bullets={[
                  t('audience.recruiter.b1'),
                  t('audience.recruiter.b2'),
                  t('audience.recruiter.b3'),
                ]}
                ctaLabel={t('audience.recruiter.cta')}
                ctaHref="/contact"
              />
            </div>
          </div>
        </section>

        {/* ─────────────── Features ─────────────── */}
        <section id="features" className="border-t border-border/50 py-24 sm:py-32">
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

        {/* ─────────────── Pricing ─────────────── */}
        <section id="pricing" className="border-t border-border/50 bg-muted/30 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('pricing.title')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('pricing.subtitle')}
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl items-start gap-8 lg:grid-cols-3">
              <PricingCard
                name={t('pricing.starter.name')}
                price={t('pricing.starter.price')}
                perMonth={t('pricing.perMonth')}
                desc={t('pricing.starter.desc')}
                features={[
                  t('pricing.starter.f1'),
                  t('pricing.starter.f2'),
                  t('pricing.starter.f3'),
                  t('pricing.starter.f4'),
                ]}
                ctaLabel={t('pricing.cta')}
              />
              <PricingCard
                name={t('pricing.pro.name')}
                price={t('pricing.pro.price')}
                perMonth={t('pricing.perMonth')}
                desc={t('pricing.pro.desc')}
                features={[
                  t('pricing.pro.f1'),
                  t('pricing.pro.f2'),
                  t('pricing.pro.f3'),
                  t('pricing.pro.f4'),
                ]}
                ctaLabel={t('pricing.cta')}
                popular
                popularLabel={t('pricing.popular')}
              />
              <PricingCard
                name={t('pricing.premium.name')}
                price={t('pricing.premium.price')}
                perMonth={t('pricing.perMonth')}
                desc={t('pricing.premium.desc')}
                features={[
                  t('pricing.premium.f1'),
                  t('pricing.premium.f2'),
                  t('pricing.premium.f3'),
                  t('pricing.premium.f4'),
                ]}
                ctaLabel={t('pricing.cta')}
              />
            </div>

            <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
              {t('pricing.note')}
            </p>
          </div>
        </section>

        {/* ─────────────── Trust ─────────────── */}
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

        {/* ─────────────── FAQ ─────────────── */}
        <section id="faq" className="border-t border-border/50 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('faq.title')}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t('faq.subtitle')}</p>
            </div>

            <div className="mt-12 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
              <FaqItem question={t('faq.q1')} answer={t('faq.a1')} />
              <FaqItem question={t('faq.q2')} answer={t('faq.a2')} />
              <FaqItem question={t('faq.q3')} answer={t('faq.a3')} />
              <FaqItem question={t('faq.q4')} answer={t('faq.a4')} />
              <FaqItem question={t('faq.q5')} answer={t('faq.a5')} />
            </div>
          </div>
        </section>

        {/* ─────────────── Final CTA ─────────────── */}
        <section className="border-t border-border/50 bg-muted/30 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-8 py-16 text-center shadow-xl shadow-primary/20 sm:px-16">
              <div className="absolute inset-0 -z-10 opacity-20">
                <div className="absolute end-[-10%] top-[-30%] size-72 rounded-full bg-white blur-3xl" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                {t('finalCta.title')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
                {t('finalCta.subtitle')}
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/register">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 text-base shadow-lg"
                  >
                    {t('finalCta.cta')}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

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
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-2xl border border-border/50 bg-card p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="text-sm font-bold text-muted-foreground/60">{step}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function AudienceCard({
  label,
  title,
  bullets,
  ctaLabel,
  ctaHref,
  highlight = false,
}: {
  label: string;
  title: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        'flex flex-col rounded-2xl border bg-card p-8 ' +
        (highlight ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-border/50')
      }
    >
      <span className="text-sm font-semibold text-primary">{label}</span>
      <h3 className="mt-2 text-xl font-bold text-foreground">{title}</h3>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link href={ctaHref}>
          <Button variant={highlight ? 'default' : 'outline'} className="w-full gap-2">
            {ctaLabel}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  perMonth,
  desc,
  features,
  ctaLabel,
  popular = false,
  popularLabel,
}: {
  name: string;
  price: string;
  perMonth: string;
  desc: string;
  features: string[];
  ctaLabel: string;
  popular?: boolean;
  popularLabel?: string;
}) {
  return (
    <div
      className={
        'relative flex flex-col rounded-2xl border bg-card p-8 ' +
        (popular
          ? 'border-primary shadow-xl shadow-primary/10 lg:-mt-4 lg:pb-12'
          : 'border-border/50')
      }
    >
      {popular && popularLabel && (
        <span className="absolute -top-3 start-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          <Star className="size-3 fill-current" />
          {popularLabel}
        </span>
      )}
      <h3 className="text-lg font-semibold text-foreground">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">{perMonth}</span>
      </div>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-foreground/80">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link href="/contact">
          <Button variant={popular ? 'default' : 'outline'} className="w-full">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group px-6 [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-start text-base font-medium text-foreground">
        {question}
        <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
    </details>
  );
}

/* A lightweight, on-brand product mockup for the hero — a CVthèque snippet
   with a score ring. Pure markup, no data, so it never blocks paint. */
function ProductPreview({ t }: { t: (k: string) => string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/5">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        <div className="mx-auto flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          <Search className="size-3" />
          {t('nav.candidates')}
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <CandidateChip name="S. B." score={92} tags={['React', 'Node']} />
        <CandidateChip name="Y. M." score={87} tags={['Python', 'SQL']} />
        <CandidateChip name="I. K." score={95} tags={['Go', 'K8s']} />
      </div>
    </div>
  );
}

function CandidateChip({
  name,
  score,
  tags,
}: {
  name: string;
  score: number;
  tags: string[];
}) {
  const circumference = 2 * Math.PI * 18;
  const dash = (score / 100) * circumference;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/60 p-4">
      <div className="relative size-12 shrink-0">
        <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/40" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="text-primary"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
          {score}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
