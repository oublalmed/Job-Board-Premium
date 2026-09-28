import Image from 'next/image';

// The Cobalt brand lockup (icon + wordmark + tagline). Served from
// /public/cobalt-logo.png (682×262). Height-driven; width scales via
// `h-* w-auto` on the className so callers control the size.
export function Logo({
  className = 'h-8 w-auto',
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/cobalt-logo.png"
      alt="Cobalt"
      width={682}
      height={262}
      className={className}
      priority={priority}
    />
  );
}
