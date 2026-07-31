export const DEFAULT_COOLDOWN_DAYS = 90;
export const COOLDOWN_SETTINGS_KEY = 'assessment_cooldown_days';

// Day-based, not calendar-month — same reasoning as common/date-utils.ts's
// addDays (Lot 6D): avoids setMonth's month-boundary edge cases.
export function computeCooldownEnd(completedAt: Date, cooldownDays: number): Date {
  const end = new Date(completedAt.getTime());
  end.setDate(end.getDate() + cooldownDays);
  return end;
}
