'use client';

import { create } from 'zustand';
import { type CandidateFilters, EMPTY_FILTERS } from './types';

// Applied search state lives in a Zustand store (not page-local state) so
// a recruiter who opens a candidate and hits Back returns to the same
// results and filters — the store outlives the route. Draft input values
// stay local to the page; only *applied* filters land here.
interface CandidateSearchState {
  filters: CandidateFilters;
  view: 'cards' | 'table';
  hasSearched: boolean;
  apply: (filters: CandidateFilters) => void;
  setView: (view: 'cards' | 'table') => void;
  reset: () => void;
}

export const useCandidateSearchStore = create<CandidateSearchState>((set) => ({
  filters: EMPTY_FILTERS,
  view: 'cards',
  hasSearched: false,
  apply: (filters) => set({ filters, hasSearched: true }),
  setView: (view) => set({ view }),
  reset: () => set({ filters: EMPTY_FILTERS, hasSearched: false }),
}));
