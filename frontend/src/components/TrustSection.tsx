import {
  Building2,
  Landmark,
  ShoppingBag,
  HeartPulse,
  Factory,
  GraduationCap,
} from 'lucide-react';

// No real client logos exist yet — showing invented company names as
// "trusted by" would be a false endorsement claim. Sector badges convey
// the same "we work across the market" signal honestly; swap in real
// logos here once clients opt in to being named.
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
  return (
    <section id="trust" className="border-t border-border/50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

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
      </div>
    </section>
  );
}
