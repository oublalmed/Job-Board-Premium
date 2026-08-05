'use client';

import * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Responsive wrapper for Recharts. Recharts needs an explicit pixel
 * height; width flexes to the container. Charts inside receive theme
 * colors via CSS custom properties (var(--color-primary) etc.), so they
 * follow the recruiter/candidate/dark themes with no hardcoded hex.
 */
export function ChartContainer({
  className,
  height = 240,
  children,
}: {
  className?: string;
  height?: number;
  children: React.ReactElement;
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Recharts injects these props into a custom tooltip `content` element at
// runtime. Typed locally rather than importing Recharts' `TooltipProps`,
// whose generic shape churned between v2 and v3 — this stays stable and
// only names the fields we actually render.
interface ChartTooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
}

/** Themed tooltip body matching the app's popover surface. */
export function ChartTooltipContent({
  active,
  payload,
  label,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label != null && label !== '' && (
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, i) => (
          <div key={`${item.dataKey ?? item.name ?? i}`} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            {item.name != null && (
              <span className="text-muted-foreground">{item.name}</span>
            )}
            <span className="ms-auto font-medium text-popover-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
