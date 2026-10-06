'use client';

import { useState } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from './Logo';
import { useLocale } from '@/i18n/locale-context';
import type { SupportedLocale } from '@/i18n';

// The image side of the sign in / sign up split: a professional photo with a
// dark overlay, the (white) logo top-left and a rotating client testimonial at
// the bottom — matching the reference design. Shared by both auth pages.

interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

const TESTIMONIALS: Record<SupportedLocale, Testimonial[]> = {
  fr: [
    {
      quote:
        'Skillink nous a fait gagner un temps précieux : les candidats sont déjà évalués, on ne rencontre que les bons profils.',
      author: 'Salma Bennani',
      role: 'Responsable RH, Casablanca',
    },
    {
      quote:
        'Des scores fiables et des compétences vérifiées : nos recrutements techniques n’ont jamais été aussi sereins.',
      author: 'Younes Mansouri',
      role: 'CTO, startup fintech',
    },
    {
      quote:
        'En tant que candidat, mon profil est enfin jugé sur mes compétences réelles, pas seulement sur mon CV.',
      author: 'Imane Khalloufi',
      role: 'Ingénieure logiciel',
    },
  ],
  en: [
    {
      quote:
        'Skillink saved us real time: candidates are pre-assessed, so we only ever meet the right profiles.',
      author: 'Salma Bennani',
      role: 'Head of HR, Casablanca',
    },
    {
      quote:
        'Reliable scores and verified skills — our technical hiring has never been smoother.',
      author: 'Younes Mansouri',
      role: 'CTO, fintech startup',
    },
    {
      quote:
        'As a candidate, I’m finally judged on my real skills, not just my résumé.',
      author: 'Imane Khalloufi',
      role: 'Software engineer',
    },
  ],
  ar: [
    {
      quote:
        'وفّر لنا Skillink وقتًا ثمينًا: المرشّحون مُقيَّمون مسبقًا، فلا نقابل سوى الملفّات المناسبة.',
      author: 'سلمى بنّاني',
      role: 'مديرة موارد بشرية، الدار البيضاء',
    },
    {
      quote: 'نتائج موثوقة ومهارات مُوثَّقة — لم يكن التوظيف التقني أسهل من ذلك قطّ.',
      author: 'يونس المنصوري',
      role: 'مدير تقني، شركة ناشئة',
    },
    {
      quote: 'كمرشّح، أصبح تقييمي أخيرًا على مهاراتي الحقيقية لا على سيرتي الذاتية فقط.',
      author: 'إيمان خلّوفي',
      role: 'مهندسة برمجيات',
    },
  ],
};

// A professional work photo (Unsplash CDN). A dark fallback + overlay keep the
// panel looking intentional even if the image fails to load.
const PHOTO_URL =
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80';

export function AuthBrandPanel() {
  const { locale } = useLocale();
  const items = TESTIMONIALS[locale] ?? TESTIMONIALS.fr;
  const [index, setIndex] = useState(0);
  const current = items[index];
  const go = (dir: number) =>
    setIndex((i) => (i + dir + items.length) % items.length);

  return (
    <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
      {/* photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${PHOTO_URL}')` }}
      />
      {/* legibility overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/45" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
        <Logo className="h-9 w-auto brightness-0 invert" priority />

        <figure className="max-w-lg">
          <Quote className="size-8 text-white/40" aria-hidden="true" />
          <blockquote className="mt-3 text-xl leading-relaxed text-white">
            {current.quote}
          </blockquote>
          <figcaption className="mt-5">
            <div className="font-semibold text-white">{current.author}</div>
            <div className="text-sm text-white/70">{current.role}</div>
          </figcaption>

          <div className="mt-7 flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Précédent"
              className="flex size-9 items-center justify-center rounded-full border border-white/30 text-white/90 transition-colors hover:bg-white/10"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Suivant"
              className="flex size-9 items-center justify-center rounded-full border border-white/30 text-white/90 transition-colors hover:bg-white/10"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
        </figure>
      </div>
    </div>
  );
}
