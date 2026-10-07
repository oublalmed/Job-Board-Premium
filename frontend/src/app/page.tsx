'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Check,
  UserPlus,
  FileCheck2,
  Send,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import type { SupportedLocale } from '@/i18n';

/* ─────────────────────────────────────────────────────────────
   MaySync — dark editorial landing.
   Self-contained dark theme (does NOT use the shared light Navbar/
   Footer): the whole page is theme-locked dark. Palette is scoped
   here with arbitrary values so the app's light tokens are untouched.
   All copy stays in i18n (fr/en/ar) via t(); no new keys added.
   ──────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

// Real professional portraits (verified) for the hero collage. Served as CSS
// background-images so no next/image remote config is needed.
const PHOTO = {
  a: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=600&fit=crop&q=70',
  b: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop&q=70',
  c: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop&q=70',
} as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const { t, locale, setLocale } = useLocale();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: '#how', label: t('nav.how') },
    { href: '#features', label: t('features.title') },
    { href: '#faq', label: t('faq.title') },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-[#0a0b12] text-white">
        {/* ─────────────── Top bar ─────────────── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0b12]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" aria-label={t('app.name')} className="flex items-center">
              <Image
                src="/maysync-logo-ondark.png"
                alt={t('app.name')}
                width={679}
                height={169}
                priority
                className="h-8 w-auto sm:h-10"
              />
            </Link>

            <nav
              aria-label={t('nav.label')}
              className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex"
            >
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="transition-colors hover:text-white">
                  {l.label}
                </a>
              ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden items-center gap-3 md:flex">
              <LangSwitch locale={locale} setLocale={setLocale} />
              <Link
                href="/login"
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0a0b12] transition-transform hover:-translate-y-px active:translate-y-0"
              >
                {t('nav.register')}
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="border-t border-white/10 bg-[#0a0b12] px-4 py-5 md:hidden">
              <nav className="flex flex-col gap-1" aria-label={t('nav.label')}>
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <LangSwitch locale={locale} setLocale={setLocale} />
                <Link
                  href="/login"
                  className="text-sm font-medium text-white/70 hover:text-white"
                >
                  {t('nav.login')}
                </Link>
              </div>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="mt-4 flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#0a0b12]"
              >
                {t('nav.register')}
              </Link>
            </div>
          )}
        </header>

        <main>
          {/* ─────────────── Hero ─────────────── */}
          <section className="relative overflow-hidden">
            <GlowField />
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:pb-28 lg:pt-20">
              {/* Left — message */}
              <motion.div
                className="max-w-2xl"
                initial={reduce ? false : 'hidden'}
                animate="show"
                variants={stagger}
              >
                <motion.span
                  variants={fadeUp}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/70"
                >
                  <span className="size-1.5 rounded-full bg-gradient-to-r from-[#35B6FF] to-[#A64DFF]" />
                  {t('hero.badge')}
                </motion.span>

                <motion.h1
                  variants={fadeUp}
                  className="mt-6 text-[clamp(2.75rem,6vw,4.75rem)] font-black leading-[0.98] tracking-tight"
                >
                  {t('hero.title')}{' '}
                  <span className="bg-gradient-to-r from-[#35B6FF] via-[#5B6CF6] to-[#A64DFF] bg-clip-text text-transparent">
                    {t('hero.titleHighlight')}
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  className="mt-7 max-w-xl text-lg leading-relaxed text-white/60"
                >
                  {t('hero.subtitle')}
                </motion.p>

                <motion.div variants={fadeUp} className="mt-9">
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2E7CFF] to-[#7A3DFF] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5B6CF6]/25 transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {t('hero.cta')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8"
                >
                  <Stat value={t('hero.stat1Value')} label={t('hero.stat1Label')} />
                  <Stat value={t('hero.stat2Value')} label={t('hero.stat2Label')} />
                  <Stat value={t('hero.stat3Value')} label={t('hero.stat3Label')} />
                </motion.div>
              </motion.div>

              {/* Right — portrait collage */}
              <PhotoCollage reduce={!!reduce} />
            </div>
          </section>

          {/* ─────────────── How it works ─────────────── */}
          <section id="how" className="border-t border-white/5 py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Reveal className="max-w-2xl">
                <motion.h2
                  variants={fadeUp}
                  className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight"
                >
                  {t('how.title')}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-4 text-lg text-white/55">
                  {t('how.subtitle')}
                </motion.p>
              </Reveal>

              <Reveal className="mt-14 grid gap-5 md:grid-cols-3">
                <StepCard n="01" icon={UserPlus} title={t('how.step1Title')} description={t('how.step1Desc')} />
                <StepCard n="02" icon={FileCheck2} title={t('how.step2Title')} description={t('how.step2Desc')} />
                <StepCard n="03" icon={Send} title={t('how.step3Title')} description={t('how.step3Desc')} />
              </Reveal>
            </div>
          </section>

          {/* ─────────────── Audience (dual path) ─────────────── */}
          <section className="border-t border-white/5 bg-[#0c0d17] py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Reveal className="max-w-2xl">
                <motion.h2
                  variants={fadeUp}
                  className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight"
                >
                  {t('audience.title')}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-4 text-lg text-white/55">
                  {t('audience.subtitle')}
                </motion.p>
              </Reveal>

              <Reveal className="mt-14 grid gap-5 lg:grid-cols-2">
                <AudienceCard
                  label={t('audience.candidate.label')}
                  title={t('audience.candidate.title')}
                  bullets={[t('audience.candidate.b1'), t('audience.candidate.b2'), t('audience.candidate.b3')]}
                  ctaLabel={t('audience.candidate.cta')}
                  ctaHref="/register"
                  highlight
                />
                <AudienceCard
                  label={t('audience.recruiter.label')}
                  title={t('audience.recruiter.title')}
                  bullets={[t('audience.recruiter.b1'), t('audience.recruiter.b2'), t('audience.recruiter.b3')]}
                  ctaLabel={t('audience.recruiter.cta')}
                  ctaHref="/contact"
                />
              </Reveal>
            </div>
          </section>

          {/* ─────────────── Features (bento) ─────────────── */}
          <section id="features" className="border-t border-white/5 py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Reveal className="max-w-2xl">
                <motion.h2
                  variants={fadeUp}
                  className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight"
                >
                  {t('features.title')}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-4 text-lg text-white/55">
                  {t('features.subtitle')}
                </motion.p>
              </Reveal>

              <Reveal className="mt-14 grid gap-5 md:grid-cols-3">
                <FeatureCard className="md:col-span-2" accent icon={BarChart3} title={t('features.scoring.title')} description={t('features.scoring.description')} />
                <FeatureCard icon={Search} title={t('features.cvtheque.title')} description={t('features.cvtheque.description')} />
                <FeatureCard icon={MessageSquare} title={t('features.messaging.title')} description={t('features.messaging.description')} />
                <FeatureCard className="md:col-span-2" accent icon={ShieldCheck} title={t('features.compliance.title')} description={t('features.compliance.description')} />
              </Reveal>
            </div>
          </section>

          {/* ─────────────── FAQ ─────────────── */}
          <section id="faq" className="border-t border-white/5 bg-[#0c0d17] py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <Reveal>
                <motion.h2
                  variants={fadeUp}
                  className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight"
                >
                  {t('faq.title')}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-4 text-lg text-white/55">
                  {t('faq.subtitle')}
                </motion.p>
              </Reveal>

              <Reveal className="mt-12 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
                <FaqItem question={t('faq.q1')} answer={t('faq.a1')} />
                <FaqItem question={t('faq.q2')} answer={t('faq.a2')} />
                <FaqItem question={t('faq.q3')} answer={t('faq.a3')} />
                <FaqItem question={t('faq.q4')} answer={t('faq.a4')} />
                <FaqItem question={t('faq.q5')} answer={t('faq.a5')} />
              </Reveal>
            </div>
          </section>

          {/* ─────────────── Final CTA ─────────────── */}
          <section className="border-t border-white/5 py-24 sm:py-32">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <Reveal>
                <motion.div
                  variants={fadeUp}
                  className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a1140] via-[#101230] to-[#0a1a30] px-8 py-16 text-center sm:px-16 sm:py-20"
                >
                  <div className="pointer-events-none absolute -top-1/3 start-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#35B6FF]/30 to-[#A64DFF]/30 blur-3xl" />
                  <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-black leading-tight tracking-tight">
                    {t('finalCta.title')}
                  </h2>
                  <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
                    {t('finalCta.subtitle')}
                  </p>
                  <div className="mt-9 flex justify-center">
                    <Link
                      href="/register"
                      className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#0a0b12] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {t('finalCta.cta')}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </div>
                </motion.div>
              </Reveal>
            </div>
          </section>
        </main>

        {/* ─────────────── Footer ─────────────── */}
        <footer className="border-t border-white/5 py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
            <Image
              src="/maysync-logo-ondark.png"
              alt={t('app.name')}
              width={679}
              height={169}
              className="h-8 w-auto opacity-80"
            />
            <nav className="flex items-center gap-6 text-sm text-white/55">
              <Link href="/terms" className="transition-colors hover:text-white">
                {t('footer.terms')}
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                {t('footer.privacy')}
              </Link>
              <Link href="/contact" className="transition-colors hover:text-white">
                {t('footer.contact')}
              </Link>
            </nav>
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} {t('app.name')}
            </p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

function LangSwitch({
  locale,
  setLocale,
}: {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
}) {
  const locales: SupportedLocale[] = ['fr', 'en', 'ar'];
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={
            'rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors ' +
            (locale === l
              ? 'bg-white text-[#0a0b12]'
              : 'text-white/60 hover:text-white')
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function GlowField() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 start-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#1b2a6b]/25 blur-[120px]" />
      <div className="absolute end-[-10%] top-10 h-[30rem] w-[30rem] rounded-full bg-[#5B2B8F]/20 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-black sm:text-3xl">{value}</span>
      <span className="text-xs text-white/50 sm:text-sm">{label}</span>
    </div>
  );
}

/* Organic, rotated cluster of masked portrait shapes — the editorial hero
   signature. Floats gently; collapses to a compact cluster on mobile. */
function PhotoCollage({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[30rem] lg:max-w-none"
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
    >
      {/* gradient backdrop */}
      <div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-[#2E7CFF]/25 via-transparent to-[#7A3DFF]/25 blur-2xl" />

      {/* large portrait — organic blob mask */}
      <motion.div
        className="absolute end-[6%] top-[4%] size-[62%] overflow-hidden rounded-[58%_42%_55%_45%/50%_55%_45%_50%] border border-white/10 shadow-2xl shadow-black/40"
        style={{ backgroundImage: `url(${PHOTO.a})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        animate={reduce ? undefined : { y: [0, -14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* medium portrait — circle */}
      <motion.div
        className="absolute start-[2%] top-[30%] size-[40%] overflow-hidden rounded-full border border-white/10 shadow-2xl shadow-black/40"
        style={{ backgroundImage: `url(${PHOTO.b})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        animate={reduce ? undefined : { y: [0, 12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      {/* small portrait — circle */}
      <motion.div
        className="absolute bottom-[4%] end-[22%] size-[34%] overflow-hidden rounded-full border border-white/10 shadow-2xl shadow-black/40"
        style={{ backgroundImage: `url(${PHOTO.c})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
      />

      {/* floating score accent — ties it to the product */}
      <div className="absolute bottom-[14%] start-[6%] flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0b12]/80 px-3 py-2 backdrop-blur">
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#35B6FF] to-[#A64DFF] text-[11px] font-black text-white">
          95
        </span>
        <ShieldCheck className="size-4 text-[#35B6FF]" />
      </div>
    </motion.div>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  description,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="group rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-white/5 text-white">
          <Icon className="size-5" />
        </span>
        <span className="font-mono text-sm text-white/30">{n}</span>
      </div>
      <h3 className="mt-6 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
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
        'relative flex flex-col overflow-hidden rounded-3xl border p-8 sm:p-10 ' +
        (highlight
          ? 'border-white/15 bg-gradient-to-br from-[#171a3a] to-[#0d0e1c]'
          : 'border-white/10 bg-white/[0.02]')
      }
    >
      <span className="text-sm font-semibold text-[#8CA2FF]">{label}</span>
      <h3 className="mt-2 text-2xl font-black tracking-tight">{title}</h3>
      <ul className="mt-7 flex flex-1 flex-col gap-3.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-white/70">
            <Check className="mt-0.5 size-4 shrink-0 text-[#35B6FF]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-9">
        <Link
          href={ctaHref}
          className={
            'group inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0 ' +
            (highlight
              ? 'bg-gradient-to-r from-[#2E7CFF] to-[#7A3DFF] text-white shadow-lg shadow-[#5B6CF6]/25'
              : 'border border-white/15 text-white hover:bg-white/5')
          }
        >
          {ctaLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  className = '',
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={
        'group relative overflow-hidden rounded-3xl border border-white/10 p-8 transition-colors hover:border-white/20 ' +
        (accent
          ? 'bg-gradient-to-br from-[#121a33] to-[#0b0c16]'
          : 'bg-white/[0.02] hover:bg-white/[0.04]') +
        ' ' +
        className
      }
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2E7CFF]/20 to-[#7A3DFF]/20 text-[#8CA2FF]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">{description}</p>
    </motion.div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group px-6 [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-start text-base font-semibold text-white">
        {question}
        <Plus className="size-4 shrink-0 text-white/50 transition-transform group-open:rotate-45" />
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-white/55">{answer}</p>
    </details>
  );
}
