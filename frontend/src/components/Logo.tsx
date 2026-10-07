import Image from 'next/image';

// The official Vocatic brand lockup (icon + wordmark + tagline). Served from
// /public/vocatic-logo.png (790×316, transparent background — sits on any
// surface). The distinct filename is a cache-bust: pointing at a brand-new path
// forces every client/optimizer to refetch rather than serve the prior logo.
// Height-driven: callers pass `h-* w-auto` and the width follows the intrinsic
// ratio. `quality={100}` keeps the wordmark crisp at small sizes.
export function Logo({
  className = 'h-9 w-auto',
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/vocatic-logo.png"
      alt="Vocatic — Specialized Talent, Better Matches"
      width={790}
      height={316}
      quality={100}
      className={className}
      priority={priority}
    />
  );
}
