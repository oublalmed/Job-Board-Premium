'use client';

import {
  Building2,
  Landmark,
  ShoppingBag,
  HeartPulse,
  Factory,
  GraduationCap,
} from 'lucide-react';
import { usePartners } from '@/features/partners/queries';

// When real partner companies have been onboarded (they have a logo), we show
// their logos. Until then — a fresh or un-seeded environment — we fall back to
// honest sector badges rather than inventing client names, so the section is
// never empty and never claims an endorsement that doesn't exist.
const SECTORS: { icon: React.ComponentType<{ className?: string }>; key: string }[] = [
  { icon: Building2, key: 'tech' },
  { icon: Landmark, key: 'finance' },
  { icon: ShoppingBag, key: 'retail' },
  { icon: HeartPulse, key: 'health' },
  { icon: Factory, key: 'industry' },
  { icon: GraduationCap, key: 'education' },
];

export function TrustSection({
  title,
  sectorLabels,
}: {
  title: string;
  sectorLabels: Record<string, string>;
}) {
  const { data: partners } = usePartners();
  const hasPartners = !!partners && partners.length > 0;

  return (
    <section id="trust" className="border-t border-border/50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

        {hasPartners ? (
          <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 items-center gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {partners.map((partner) => (
              <li key={partner.id} className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- logos are
                    arbitrary remote/data URIs, not statically optimizable assets */}
                <img
                  src={partner.logo ?? ''}
                  alt={partner.name}
                  loading="lazy"
                  className="h-14 w-auto opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {partner.name}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {SECTORS.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex flex-col items-center gap-2 text-muted-foreground/70 grayscale transition-all duration-300 hover:text-foreground hover:grayscale-0"
              >
                <Icon className="size-7" />
                <span className="text-xs font-medium">{sectorLabels[key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
