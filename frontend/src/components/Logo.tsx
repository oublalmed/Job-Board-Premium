import Image from 'next/image';

// The official Skillink brand lockup (icon + wordmark + tagline). Served from
// /public/skillink-logo.png (1983×793, white background that blends into the
// app's near-white surfaces). Height-driven: callers pass `h-* w-auto` and the
// width follows the intrinsic ratio.
export function Logo({
  className = 'h-9 w-auto',
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/skillink-logo.png"
      alt="Skillink — Talents, Opportunités, Avenir"
      width={1983}
      height={793}
      className={className}
      priority={priority}
    />
  );
}
