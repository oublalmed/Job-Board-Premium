'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  Zap,
  ShieldCheck,
  BarChart3,
  Briefcase,
  Star,
  TrendingUp,
  MapPin,
  Bell,
  Search,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useLocale } from '@/i18n/locale-context';

// Bespoke marketing palette — hardcoded (not theme tokens) so the hero renders
// identically in light and dark mode, matching the brand banner.
const NAVY = '#0a1230';
const GRADIENT = 'linear-gradient(135deg,#4f7cff 0%,#8b5cf6 100%)';

function CobaltMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id="cobaltMark"
          x1="6"
          y1="6"
          x2="42"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5b8cff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="15"
        stroke="url(#cobaltMark)"
        strokeWidth="8"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="70 30"
        transform="rotate(-38 24 24)"
      />
      <path
        d="M33 16.5l2.1 4.4 4.4 2.1-4.4 2.1-2.1 4.4-2.1-4.4-4.4-2.1 4.4-2.1z"
        fill="#fff"
      />
    </svg>
  );
}

// Sample data for the illustrative panels (names are decorative, not i18n).
const TALENTS = [
  { name: 'Yassine El Mansouri', role: 'Développeur Full Stack', meta: 'Rabat · 2 ans', match: 98 },
  { name: 'Salma Benali', role: 'Data Analyst', meta: 'Casablanca · 3 ans', match: 94 },
  { name: 'Omar El Idrissi', role: 'Product Manager', meta: 'Tanger · 5 ans', match: 92 },
];

export default function HomePage() {
  const { t } = useLocale();

  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* ============ HERO BANNER ============ */}
        <section className="relative overflow-hidden" style={{ background: NAVY }}>
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle,#4f7cff55,transparent 70%)' }}
            />
            <div
              className="absolute right-0 top-10 h-[380px] w-[520px] rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle,#8b5cf644,transparent 70%)' }}
            />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 py-14 sm:py-16 lg:grid-cols-[1.1fr_auto_1fr] lg:gap-12">
            {/* Brand lockup */}
            <div className="flex items-center gap-5">
              <CobaltMark className="h-16 w-16 shrink-0 drop-shadow-[0_4px_20px_rgba(79,124,255,0.5)] sm:h-20 sm:w-20" />
              <div>
                <div className="flex items-start gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                    Cobalt
                  </span>
                  <span className="mt-1 text-xs text-white/50">™</span>
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.35em] text-white/60">
                  {t('landing.tagline')}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden h-24 w-px bg-white/15 lg:block" />

            {/* Kicker */}
            <div className="max-w-md">
              <p className="text-xl font-semibold leading-snug text-white sm:text-2xl">
                {t('landing.heroLead')}{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: GRADIENT }}
                >
                  {t('landing.heroLeadHighlight')}
                </span>
              </p>
              <p className="mt-3 text-sm text-white/70">
                {t('landing.heroSub1')}
                <br />
                {t('landing.heroSub2')}
              </p>
            </div>
          </div>
        </section>

        {/* ============ SPLIT: ENTREPRISES / CANDIDATS ============ */}
        <section className="grid lg:grid-cols-2">
          {/* --- Pour les entreprises (dark) --- */}
          <div
            className="relative overflow-hidden px-6 py-16 sm:px-10 lg:px-14"
            style={{ background: NAVY }}
          >
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle,#4f7cff33,transparent 70%)' }}
            />
            <div className="relative mx-auto max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7aa0ff]">
                {t('landing.companies.eyebrow')}
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
                {t('landing.companies.title')}{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: GRADIENT }}
                >
                  {t('landing.companies.titleHighlight')}
                </span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                {t('landing.companies.desc')}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                <DarkFeature icon={BrainCircuit} label={t('landing.companies.f1')} />
                <DarkFeature icon={Zap} label={t('landing.companies.f2')} />
                <DarkFeature icon={ShieldCheck} label={t('landing.companies.f3')} />
                <DarkFeature icon={BarChart3} label={t('landing.companies.f4')} />
              </ul>

              {/* Faux dashboard */}
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CobaltMark className="h-5 w-5" />
                    <span className="text-sm font-semibold text-white">Cobalt</span>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                    <Search className="size-3" /> {t('landing.companies.panelBadge')}
                  </span>
                </div>
                <p className="mb-2 text-xs font-medium text-white/60">
                  {t('landing.companies.panelTitle')}
                </p>
                <div className="flex flex-col gap-2">
                  {TALENTS.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2"
                    >
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: GRADIENT }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">{c.name}</p>
                        <p className="truncate text-[11px] text-white/55">
                          {c.role} · {c.meta}
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {c.match}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                  <TrendingUp className="size-4 text-[#7aa0ff]" />
                  <span className="text-[11px] text-white/70">
                    {t('landing.companies.panelStat')}
                  </span>
                  <span className="ms-auto text-sm font-bold text-emerald-300">+78%</span>
                </div>
              </div>

              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition-transform hover:scale-[1.02]"
                style={{ background: GRADIENT }}
              >
                {t('landing.companies.cta')}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>

          {/* --- Pour les candidats (light) --- */}
          <div className="relative overflow-hidden bg-[#eef2fb] px-6 py-16 sm:px-10 lg:px-14">
            <div
              className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle,#8b5cf622,transparent 70%)' }}
            />
            <div className="relative mx-auto max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#5b6bff]">
                {t('landing.candidates.eyebrow')}
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-[#0f1633] sm:text-4xl">
                {t('landing.candidates.title')}{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: GRADIENT }}
                >
                  {t('landing.candidates.titleHighlight')}
                </span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {t('landing.candidates.desc')}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                <LightFeature icon={Briefcase} label={t('landing.candidates.f1')} />
                <LightFeature icon={Zap} label={t('landing.candidates.f2')} />
                <LightFeature icon={Star} label={t('landing.candidates.f3')} />
                <LightFeature icon={TrendingUp} label={t('landing.candidates.f4')} />
              </ul>

              {/* Faux job cards */}
              <div className="mt-10 flex flex-col gap-3">
                <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <MapPin className="size-4 text-[#5b6bff]" />
                  <span className="text-xs font-medium text-slate-700">
                    {t('landing.candidates.nearYou')}
                  </span>
                </div>
                <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-300/40">
                  <span className="absolute -top-3 end-4 flex items-center gap-1.5 rounded-full bg-[#0f1633] px-3 py-1 text-[11px] font-medium text-white">
                    <Bell className="size-3" /> {t('landing.candidates.newJobs')}
                  </span>
                  <div className="mb-3 flex items-center gap-2">
                    <CobaltMark className="h-6 w-6" />
                    <span className="font-semibold text-[#0f1633]">Cobalt</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0f1633]">
                        {t('landing.candidates.jobTitle')}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Briefcase className="size-3.5" /> {t('landing.candidates.jobType')}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5" /> {t('landing.candidates.jobLocation')}
                        </span>
                      </p>
                    </div>
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: GRADIENT }}
                    >
                      <ArrowRight className="size-4 rtl:rotate-180" />
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
                style={{ background: GRADIENT }}
              >
                {t('landing.candidates.cta')}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============ TRUST STRIP ============ */}
        <section style={{ background: '#070c22' }}>
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-8 lg:flex-row lg:justify-between">
            <div className="flex items-center gap-2.5">
              <CobaltMark className="h-8 w-8" />
              <div className="leading-none">
                <span className="text-lg font-bold text-white">Cobalt</span>
                <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
                  {t('landing.tagline')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <StripItem icon={BrainCircuit} label={t('landing.strip.ai')} />
              <StripItem icon={ShieldCheck} label={t('landing.strip.security')} />
              <StripItem icon={MapPin} label={t('landing.strip.ecosystem')} />
            </div>

            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 lg:text-right">
              {t('landing.strip.slogan')}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function DarkFeature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-[#7aa0ff]">
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-medium text-white/85">{label}</span>
    </li>
  );
}

function LightFeature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5b6bff]/10 text-[#5b6bff]">
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </li>
  );
}

function StripItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-sm text-white/70">
      <Icon className="size-4 text-[#7aa0ff]" />
      {label}
    </span>
  );
}
