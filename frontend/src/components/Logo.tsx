import Image from 'next/image';

// The official Vocatic brand lockup (icon + wordmark + tagline). Served from
// /public/vocatic-logo-v2.png (633×174, transparent background — sits on any
// surface). This is the source artwork with its heavy transparent padding
// trimmed off, so the wordmark + "Specialized Talent • Better Matches." tagline
// fill the box and stay legible at header sizes; the `-v2` filename also busts
// the cache of the earlier (padded) asset. Height-driven: callers pass
// `h-* w-auto` and the width follows the intrinsic ratio. `quality={100}` keeps
// the tagline crisp at small sizes.
export function Logo({
  className = 'h-9 w-auto',
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/vocatic-logo-v2.png"
      alt="Vocatic — Specialized Talent, Better Matches"
      width={633}
      height={174}
      quality={100}
      className={className}
      priority={priority}
    />
  );
}
