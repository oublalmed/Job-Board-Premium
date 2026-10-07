import Image from 'next/image';

// The official MaySync brand lockup (icon + wordmark + tagline). Served from
// /public/maysync-logo.png (679×169, transparent background — sits on any
// surface). This is the source artwork with its heavy transparent padding
// trimmed off, so the wordmark + "Le bon talent, au bon moment" tagline fill
// the box and stay legible at header sizes; the distinct filename also busts
// the cache of the previous brand's asset. Height-driven: callers pass
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
      src="/maysync-logo.png"
      alt="MaySync — Le bon talent, au bon moment"
      width={679}
      height={169}
      quality={100}
      className={className}
      priority={priority}
    />
  );
}
