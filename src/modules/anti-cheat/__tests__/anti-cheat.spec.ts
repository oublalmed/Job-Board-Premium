import { computeSuspicionLevel, countSuspiciousEvents } from '../anti-cheat.js';

const base = {
  tabSwitchCount: 0,
  windowBlurCount: 0,
  proctoringFlagged: false,
  multiAccountFlagged: false,
};

describe('computeSuspicionLevel (§2)', () => {
  it('low for clean signals', () => {
    expect(computeSuspicionLevel(base)).toBe('low');
    expect(computeSuspicionLevel({ ...base, tabSwitchCount: 1 })).toBe('low');
  });

  it('medium for repeated focus loss', () => {
    expect(computeSuspicionLevel({ ...base, tabSwitchCount: 3 })).toBe(
      'medium',
    );
    expect(computeSuspicionLevel({ ...base, windowBlurCount: 4 })).toBe(
      'medium',
    );
  });

  it('high when a hard flag is raised', () => {
    expect(computeSuspicionLevel({ ...base, proctoringFlagged: true })).toBe(
      'high',
    );
    expect(computeSuspicionLevel({ ...base, multiAccountFlagged: true })).toBe(
      'high',
    );
    // A hard flag dominates even with few focus events.
    expect(
      computeSuspicionLevel({
        ...base,
        tabSwitchCount: 1,
        proctoringFlagged: true,
      }),
    ).toBe('high');
  });

  it('counts suspicious events', () => {
    expect(
      countSuspiciousEvents({
        tabSwitchCount: 2,
        windowBlurCount: 1,
        proctoringFlagged: true,
        multiAccountFlagged: false,
      }),
    ).toBe(4);
  });
});
