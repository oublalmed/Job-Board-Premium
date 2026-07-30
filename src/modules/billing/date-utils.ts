// Plain day-based arithmetic, deliberately not calendar-month arithmetic
// (`setMonth` has well-known edge cases — Jan 31 + 1 month lands on Mar 3,
// not Feb 28/29). Precision here is informational bookkeeping only: the
// authoritative signal for whether a subscription is still in good
// standing is always the status transition driven by a Stripe webhook
// (see subscription-guard.service.ts), never this date on its own for
// ACTIVE rows — see PROGRESS.md, Lot 6D.
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
