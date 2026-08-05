'use client';

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { Notification } from '@/features/notifications/queries';

interface ActivityDatum {
  key: string;
  label: string;
  count: number;
}

// Bucket notifications into the trailing 7 calendar days. Pure/deterministic
// so the chart is a plain function of its data.
function buildData(notifications: Notification[], locale: 'fr' | 'en'): ActivityDatum[] {
  const intl = locale === 'fr' ? 'fr-FR' : 'en-US';
  const now = new Date();
  const days: ActivityDatum[] = [];
  const index = new Map<string, number>();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: d.toLocaleDateString(intl, { weekday: 'short' }),
      count: 0,
    });
    index.set(key, days.length - 1);
  }

  for (const n of notifications) {
    const key = new Date(n.createdAt).toISOString().slice(0, 10);
    const i = index.get(key);
    if (i != null) days[i].count += 1;
  }

  return days;
}

export function ActivityChart({
  notifications,
  label,
  locale,
}: {
  notifications: Notification[];
  label: string;
  locale: 'fr' | 'en';
}) {
  const data = buildData(notifications, locale);
  return (
    <ChartContainer height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="count" name={label} radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
      </BarChart>
    </ChartContainer>
  );
}
