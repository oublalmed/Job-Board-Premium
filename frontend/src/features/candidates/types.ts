export interface CandidateResult {
  id: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  featured?: boolean;
  /**
   * CDC EF-RECR-04: the candidate's best evaluation score (0–100) and its
   * percentile rank. The backend orders the result set by this score
   * descending, so a row's position in the list *is* its ranking — these
   * fields let the UI make that ranking explicit rather than implicit.
   */
  score?: number;
  percentile?: number | null;
  /**
   * CDC EF-SRCH-05: search-list rows are an anonymised preview — the backend
   * returns the given name plus a masked family name (e.g. "Youssef" + "E.")
   * and sets this flag. Full identity is only revealed on the detail view /
   * at contact. Not yet in the generated OpenAPI schema; surfaced through the
   * domain-level cast in queries.ts.
   */
  anonymized?: boolean;
}

/** Whether a search row is an anonymised identity preview (CDC EF-SRCH-05). */
export function isAnonymized(c: CandidateResult): boolean {
  return c.anonymized === true;
}

export interface CandidateSearchResponse {
  // The API returns the page under `items` (see SearchCandidatesResult on the
  // backend). Keep this name aligned with the wire shape — reading a
  // differently-named field silently yields an empty result set.
  items: CandidateResult[];
  nextCursor?: string | null;
  total?: number;
}

export interface CandidateDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  location: string | null;
  skills: string[];
  featured: boolean;
  // EF-SRCH-05 — true until the recruiter has contacted the candidate; the last
  // name stays an initial and full identity is withheld.
  anonymized?: boolean;
  // EF-CAND-05 — availability/mobility always shown; salary only if disclosed.
  availability?: string | null;
  mobility?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
}

/** Raw filter inputs as typed by the recruiter (skills is a comma string). */
export interface CandidateFilters {
  q: string;
  skills: string;
  location: string;
  // EF-SRCH-02 — availability substring + salary budget (MAD, as text input).
  availability: string;
  salaryMax: string;
}

export const EMPTY_FILTERS: CandidateFilters = {
  q: '',
  skills: '',
  location: '',
  availability: '',
  salaryMax: '',
};

export function activeFilterCount(f: CandidateFilters): number {
  return [f.skills, f.location, f.availability, f.salaryMax].filter((v) =>
    v.trim(),
  ).length;
}
