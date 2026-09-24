// EF-EVAL-03/04 — accessible visualizations of a candidate's assessment result.
// Extracted from the assessments page so they are unit-testable in isolation
// and reusable. Both marks are progressbars with a text alternative and never
// convey meaning by colour or width alone (WCAG 1.4.1).

// EF-EVAL-03 — a normalized 0–100 score rendered as a meter, so the value reads
// as a proportion of the scale at a glance.
export function ScoreMeter({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const rounded = Math.round(value);
  const pct = Math.max(0, Math.min(100, (rounded / max) * 100));
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {rounded}/{max}
      </span>
      <div
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${rounded}/${max}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// EF-EVAL-04 — percentile as a ranking, not a bare number. A percentile of P
// means the candidate scored at or above P % of the active cohort; the bar
// fills to P and the caption states the ranking in words.
export function PercentileBar({
  label,
  rankLabel,
  percentile,
}: {
  label: string;
  rankLabel: string;
  percentile: number;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percentile)));
  return (
    <div className="col-span-2 flex flex-col gap-1.5 rounded-lg border border-border/60 px-3 py-2 sm:col-span-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{rankLabel}</span>
      <div
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rankLabel}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
