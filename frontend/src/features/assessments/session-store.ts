'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { components } from '@/api/schema';

export type AssessmentStatus = components['schemas']['Assessment']['status'];

export interface AssessmentSession {
  assessmentId: string;
  resumeToken: string | null;
  assessmentUrl: string;
  testId: string;
  status: AssessmentStatus;
}

interface SessionState {
  session: AssessmentSession | null;
  setSession: (session: AssessmentSession) => void;
  updateStatus: (status: AssessmentStatus) => void;
  clear: () => void;
}

// Replaces the page's hand-rolled sessionStorage load/save. There is no
// GET /assessments (list-mine) endpoint, so a persisted session is the
// only way the page survives a refresh; sessionStorage keeps that scoped
// to the tab (a different device genuinely can't recover it — the manual
// resume form covers that case). zustand/persist handles SSR safely:
// the store is empty on the server and first client render, then hydrates.
export const useAssessmentSession = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      updateStatus: (status) =>
        set((state) =>
          state.session ? { session: { ...state.session, status } } : state,
        ),
      clear: () => set({ session: null }),
    }),
    {
      name: 'jbp_assessment_session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
