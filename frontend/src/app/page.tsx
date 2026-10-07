'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
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

// Shared easing — one spring-ish cubic for the whole page so every reveal
// feels like the same hand. Motion here is motivated: it sequences content as
// it enters (storytelling) and acknowledges hierarchy, nothing decorative.
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/** A section that reveals its children once, as they scroll into view. */
function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
}) {
  const Comp = as === 'section' ? motion.section : motion.div;
  return (
    <Comp
      className={className}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </Comp>
  );
}

export default function HomePage() {
  const { t } = useLocale();
  const reduce = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <Navbar />

      <main className="flex-1">
        {/* ─────────────── Hero (asymmetric split) ─────────────── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
            <div className="absolute start-[-15%] top-[-20%] h-[520px] w-[720px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute end-[-10%] top-[20%] h-[420px] w-[520px] rounded-full bg-primary/5 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24 lg:pt-28">
            {/* Left — message */}
            <motion.div
              className="max-w-xl text-center lg:text-start"
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={stagger}
            >
              <motion.div variants={fadeUp}>
                <Badge variant="secondary" className="mb-6 gap-1.5">
                  <Sparkles className="size-3" />
                  {t('hero.badge')}
                </Badge>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              >
                {t('hero.title')}{' '}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {t('hero.titleHighlight')}
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0"
              >
                {t('hero.subtitle')}
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-9 flex justify-center lg:justify-start"
              >
                <Link href="/register">
                  <Button size="lg" className="gap-2 text-base">
                    {t('hero.cta')}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border/50 pt-8 lg:mx-0"
              >
                <StatItem value={t('hero.stat1Value')} label={t('hero.stat1Label')} />
                <StatItem value={t('hero.stat2Value')} label={t('hero.stat2Label')} />
                <StatItem value={t('hero.stat3Value')} label={t('hero.stat3Label')} />
              </motion.div>
            </motion.div>

            {/* Right — live product glimpse */}
            <motion.div
              className="relative"
              initial={reduce ? false : { opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            >
              <ProductPanel t={t} reduce={!!reduce} />
            </motion.div>
          </div>
        </section>

        {/* ─────────────── How it works (stepper) ─────────────── */}
        <section id="how" className="border-t border-border/50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <motion.div variants={fadeUp}>
                <Badge variant="secondary" className="mb-4">
                  {t('how.badge')}
                </Badge>
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t('how.title')}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
                {t('how.subtitle')}
              </motion.p>
            </Reveal>

            <Reveal className="relative mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-3">
              {/* connector line on desktop */}
              <div className="absolute inset-x-[16%] top-[34px] -z-10 hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent sm:block" />
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
            </Reveal>
          </div>
        </section>

        {/* ─────────────── Audience (dual path) ─────────────── */}
        <section className="border-t border-border/50 bg-muted/30 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t('audience.title')}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
                {t('audience.subtitle')}
              </motion.p>
            </Reveal>

            <Reveal className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-2">
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
            </Reveal>
          </div>
        </section>

        {/* ─────────────── Features (bento with rhythm) ─────────────── */}
        <section id="features" className="border-t border-border/50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t('features.title')}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
                {t('features.subtitle')}
              </motion.p>
            </Reveal>

            {/* 4 items → 4 cells, asymmetric: 2+1 then 1+2 */}
            <Reveal className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3">
              <FeatureCard
                className="sm:col-span-2"
                tinted
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
                className="sm:col-span-2"
                tinted
                icon={ShieldCheck}
                title={t('features.compliance.title')}
                description={t('features.compliance.description')}
              />
            </Reveal>
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

        {/* ─────────────── FAQ (accordion) ─────────────── */}
        <section id="faq" className="border-t border-border/50 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal className="text-center">
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t('faq.title')}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
                {t('faq.subtitle')}
              </motion.p>
            </Reveal>

            <Reveal className="mt-12 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
              <FaqItem question={t('faq.q1')} answer={t('faq.a1')} />
              <FaqItem question={t('faq.q2')} answer={t('faq.a2')} />
              <FaqItem question={t('faq.q3')} answer={t('faq.a3')} />
              <FaqItem question={t('faq.q4')} answer={t('faq.a4')} />
              <FaqItem question={t('faq.q5')} answer={t('faq.a5')} />
            </Reveal>
          </div>
        </section>

        {/* ─────────────── Final CTA ─────────────── */}
        <section className="border-t border-border/50 bg-muted/30 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal>
              <motion.div
                variants={fadeUp}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-8 py-16 text-center shadow-xl shadow-primary/20 sm:px-16"
              >
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
              </motion.div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </MotionConfig>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 lg:items-start">
      <span className="text-2xl font-bold text-foreground sm:text-3xl">{value}</span>
      <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  className = '',
  tinted = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={
        'group relative overflow-hidden rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 ' +
        (tinted
          ? 'bg-gradient-to-br from-primary/[0.06] to-card'
          : 'bg-card') +
        ' ' +
        className
      }
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </motion.div>
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
    <motion.div
      variants={fadeUp}
      className="relative rounded-2xl border border-border/50 bg-card p-8"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="text-sm font-bold text-muted-foreground/60">{step}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.div>
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
    <motion.div
      variants={fadeUp}
      className={
        'flex flex-col rounded-2xl border bg-card p-8 ' +
        (highlight
          ? 'border-primary/30 shadow-lg shadow-primary/5'
          : 'border-border/50')
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
    </motion.div>
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

/* An honest glimpse of the real product — a CVthèque ranking panel. Not a
   mac-window "screenshot" mock: a clean, labeled panel that mirrors the actual
   candidate-ranking UI, gently floating to feel live. */
function ProductPanel({
  t,
  reduce,
}: {
  t: (k: string) => string;
  reduce: boolean;
}) {
  return (
    <motion.div
      className="relative mx-auto max-w-md"
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="size-4 text-primary" />
            {t('nav.candidates')}
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <BarChart3 className="size-3.5" />
            {t('search.sortScoreDesc')}
          </span>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <CandidateRow name="Sara B." role="Frontend React" score={95} tags={['React', 'TypeScript']} top />
          <CandidateRow name="Youssef M." role="Data Engineer" score={88} tags={['Python', 'Spark']} />
          <CandidateRow name="Imane K." role="DevOps Cloud" score={84} tags={['Go', 'K8s']} />
        </div>
      </div>

      {/* grounding glow */}
      <div className="absolute inset-x-8 -bottom-6 -z-10 h-12 rounded-full bg-primary/20 blur-2xl" />
    </motion.div>
  );
}

function CandidateRow({
  name,
  role,
  score,
  tags,
  top = false,
}: {
  name: string;
  role: string;
  score: number;
  tags: string[];
  top?: boolean;
}) {
  const circumference = 2 * Math.PI * 18;
  const dash = (score / 100) * circumference;
  return (
    <div
      className={
        'flex items-center gap-4 rounded-xl border p-4 transition-colors ' +
        (top
          ? 'border-primary/30 bg-primary/[0.04]'
          : 'border-border/50 bg-background/60')
      }
    >
      <div className="relative size-12 shrink-0">
        <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted/40"
          />
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {top && (
            <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{role}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
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
