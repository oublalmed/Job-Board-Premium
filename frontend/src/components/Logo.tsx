// The Skillink brand lockup (icon + wordmark), drawn as inline SVG so it
// scales crisply at any size and needs no raster asset. Height-driven: callers
// pass `h-* w-auto` and the width follows the viewBox ratio, exactly as the
// previous <Image> logo behaved. The icon stays brand-blue in both themes; the
// wordmark inherits the surrounding text color, with "link" tinted to nod at
// the name (skills + link).
export function Logo({
  className = 'h-8 w-auto',
  priority: _priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 196 44"
      className={className}
      role="img"
      aria-label="Skillink"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* icon tile */}
      <rect width="44" height="44" rx="11" fill="var(--color-primary)" />
      {/* link glyph — two interlocking rounded bars */}
      <rect
        x="12"
        y="19.5"
        width="20"
        height="5"
        rx="2.5"
        fill="var(--color-primary-foreground)"
        transform="rotate(-38 22 22)"
      />
      <rect
        x="12"
        y="19.5"
        width="20"
        height="5"
        rx="2.5"
        fill="var(--color-primary-foreground)"
        transform="rotate(38 22 22)"
      />
      {/* wordmark */}
      <text
        x="56"
        y="30"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="25"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        <tspan fill="currentColor">Skill</tspan>
        <tspan fill="var(--color-primary)">ink</tspan>
      </text>
    </svg>
  );
}
