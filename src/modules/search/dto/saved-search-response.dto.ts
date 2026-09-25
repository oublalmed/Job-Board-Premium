import {
  SavedSearch,
  SavedSearchCriteria,
} from '../entities/saved-search.entity.js';

// EF-SRCH-04 — the wire shape of a saved search. Excludes the joined `owner`
// relation so no unrelated account data leaks into the payload.
export interface SavedSearchResponse {
  id: string;
  name: string;
  criteria: SavedSearchCriteria;
  alertEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toSavedSearchResponse(s: SavedSearch): SavedSearchResponse {
  return {
    id: s.id,
    name: s.name,
    criteria: s.criteria,
    alertEnabled: s.alertEnabled,
    lastNotifiedAt: s.lastNotifiedAt ? s.lastNotifiedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
