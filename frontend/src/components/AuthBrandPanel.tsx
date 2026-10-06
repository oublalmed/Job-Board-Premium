'use client';

import { ShieldCheck, BarChart3, Zap } from 'lucide-react';
import { Logo } from './Logo';
import { useLocale } from '@/i18n/locale-context';

// The brand side of the sign in / sign up split layout. A light, tech-refined
// surface — faint dot grid, soft blue→violet brand glows, icon feature tiles
// and a stat row — so the transparent logo reads in full color (no white box).
// Shared by both auth pages so they stay in sync; only the form side differs.
export function AuthBrandPanel() {
  const { t } = useLocale();

  const features = [
    { icon: ShieldCheck, label: t('auth.benefits.b1') },
    { icon: BarChart3, label: t('auth.benefits.b2') },
    { icon: Zap, label: t('auth.benefits.b3') },
  ];
  const stats = [
    { value: t('hero.stat1Value'), label: t('hero.stat1Label') },
    { value: t('hero.stat2Value'), label: t('hero.stat2Label') },
    { value: t('hero.stat3Value'), label: t('hero.stat3Label') },
  ];

  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-e border-border/50 bg-background lg:flex">
      {/* layered background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.07] via-background to-background" />
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklab, var(--color-foreground) 9%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 35%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 40%, black 35%, transparent 80%)',
        }}
      />
      <div className="absolute -start-28 top-16 -z-10 size-[28rem] rounded-full bg-primary/10 blur-[110px]" />
      <div className="absolute -end-28 bottom-8 -z-10 size-[24rem] rounded-full bg-violet-500/10 blur-[110px]" />

      {/* logo */}
      <div className="p-12">
        <Logo className="h-11 w-auto" priority />
      </div>

      {/* headline + features */}
      <div className="px-12">
        <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-foreground">
          {t('app.tagline')}
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          {t('app.description')}
        </p>
        <ul className="mt-10 flex flex-col gap-5">
          {features.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-medium text-foreground/80">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* stats */}
      <div className="border-t border-border/50 p-12">
        <dl className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block text-xl font-bold text-foreground">{s.value}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
