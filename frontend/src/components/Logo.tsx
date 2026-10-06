import Image from 'next/image';

// The official Skillink brand lockup (icon + wordmark + tagline). Served from
// /public/skillink-logo-v2.png (790×316, transparent background — sits on any
// surface). The `-v2` filename is a cache-bust: the asset was replaced once at
// the original path, so a fresh name forces every client/optimizer to refetch.
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
      src="/skillink-logo-v2.png"
      alt="Skillink — Talents, Opportunités, Avenir"
      width={790}
      height={316}
      quality={100}
      className={className}
      priority={priority}
    />
  );
}
