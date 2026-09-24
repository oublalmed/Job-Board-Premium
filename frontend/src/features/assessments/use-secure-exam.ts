'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * EF-EVAL-02 (client-side deterrent layer) — the browser-side part of the
 * "secured environment" requirement.
 *
 * This is intentionally NOT a replacement for the third-party proctoring
 * provider (plagiarism detection, behavioural signals and question-bank
 * rotation stay vendor-side). It is only the in-browser deterrent layer:
 *
 *  - requests the Fullscreen API (must be triggered from a user gesture);
 *  - counts tab-switches / window-blur events (`visibilitychange`, window
 *    `blur`) so the candidate is warned when they leave the attempt;
 *  - blocks copy / cut / paste and the context menu while the attempt is
 *    in progress.
 *
 * Every `document` / `window` access is guarded so the hook is safe to
 * import in a Server Component tree (it only touches the DOM inside effects
 * and inside the user-triggered callbacks, which never run on the server).
 */

const CAN_USE_DOM =
  typeof window !== 'undefined' && typeof document !== 'undefined';

export interface SecureExamState {
  /** Whether the deterrent guards are currently attached. */
  readonly active: boolean;
  /** Whether the document is currently displayed fullscreen. */
  readonly isFullscreen: boolean;
  /** True while the tab is hidden (candidate switched away / minimized). */
  readonly tabHidden: boolean;
  /** True while the window has lost focus. */
  readonly windowBlurred: boolean;
  /** Number of times the candidate left the tab or window during the attempt. */
  readonly leaveCount: number;
  /** Times the tab was hidden (switched away / minimized). */
  readonly tabSwitchCount: number;
  /** Times the window lost focus. */
  readonly windowBlurCount: number;
}

export interface SecureExam extends SecureExamState {
  /** Request fullscreen. Must be called from a user gesture (e.g. onClick). */
  readonly enterFullscreen: () => Promise<void>;
  /** Leave fullscreen if currently active. */
  readonly exitFullscreen: () => Promise<void>;
}

function readIsFullscreen(): boolean {
  if (!CAN_USE_DOM) return false;
  return document.fullscreenElement != null;
}

/**
 * @param enabled Attach the deterrent guards while true (the attempt is in
 * progress). When it flips back to false every listener is removed and any
 * fullscreen session is released.
 */
export function useSecureExam(enabled: boolean): SecureExam {
  // Lazy initializer: reads the real fullscreen state on the client at mount
  // (always `false` on the server and at first paint), so we never call
  // setState synchronously from the effect body just to seed it.
  const [isFullscreen, setIsFullscreen] = useState(readIsFullscreen);
  const [tabHidden, setTabHidden] = useState(false);
  const [windowBlurred, setWindowBlurred] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowBlurCount, setWindowBlurCount] = useState(0);
  // Total leave events — the single number the banner shows the candidate.
  const leaveCount = tabSwitchCount + windowBlurCount;

  const enterFullscreen = useCallback(async () => {
    if (!CAN_USE_DOM) return;
    const el = document.documentElement;
    if (document.fullscreenElement || typeof el.requestFullscreen !== 'function') {
      return;
    }
    try {
      await el.requestFullscreen();
    } catch {
      // Denied (no gesture, permissions policy, unsupported) — the guards
      // and tab-switch counting still apply; fullscreen is best-effort.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!CAN_USE_DOM) return;
    if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') {
      return;
    }
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore — nothing actionable if the browser refuses.
    }
  }, []);

  useEffect(() => {
    if (!CAN_USE_DOM || !enabled) {
      return;
    }

    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      setTabHidden(hidden);
      if (hidden) setTabSwitchCount((c) => c + 1);
    };
    const onWindowBlur = () => {
      setWindowBlurred(true);
      setWindowBlurCount((c) => c + 1);
    };
    const onWindowFocus = () => setWindowBlurred(false);
    const onFullscreenChange = () => setIsFullscreen(readIsFullscreen());
    const block = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', block);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', block);
      // Reset the transient "left the attempt" flags when the guards detach
      // (running in cleanup, not the effect body, so no cascading render).
      setTabHidden(false);
      setWindowBlurred(false);
      // Release fullscreen when the attempt ends.
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [enabled]);

  return {
    active: enabled && CAN_USE_DOM,
    isFullscreen,
    tabHidden,
    windowBlurred,
    leaveCount,
    tabSwitchCount,
    windowBlurCount,
    enterFullscreen,
    exitFullscreen,
  };
}
