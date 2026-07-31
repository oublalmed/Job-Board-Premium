// Plain day-based arithmetic, deliberately not calendar-month arithmetic
// (`setMonth` has well-known edge cases — Jan 31 + 1 month lands on Mar 3,
// not Feb 28/29).
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
