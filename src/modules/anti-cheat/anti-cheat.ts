// §2 — suspicion level from the anti-cheat signals captured during an
// assessment. Deliberately an INDICATOR, never an automatic "fraudster"
// verdict (§2.3): a technical event alone doesn't condemn a candidate.
export type SuspicionLevel = 'low' | 'medium' | 'high';

export interface IntegritySignals {
  tabSwitchCount: number;
  windowBlurCount: number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
}

export function computeSuspicionLevel(s: IntegritySignals): SuspicionLevel {
  // Hard flags raised by the secure-exam engine → high.
  if (s.proctoringFlagged || s.multiAccountFlagged) return 'high';
  // Repeated focus loss → medium.
  if (s.tabSwitchCount >= 3 || s.windowBlurCount >= 3) return 'medium';
  return 'low';
}

export function countSuspiciousEvents(s: IntegritySignals): number {
  return (
    s.tabSwitchCount +
    s.windowBlurCount +
    (s.proctoringFlagged ? 1 : 0) +
    (s.multiAccountFlagged ? 1 : 0)
  );
}
