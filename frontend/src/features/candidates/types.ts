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
   * Comparison signals surfaced in the CVthèque: the candidate's school (and
   * whether it was admin-verified) and how many evaluations they completed.
   */
  school?: string | null;
  schoolVerified?: boolean;
  assessmentCount?: number;
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

export interface CandidateExperience {
  type: 'work' | 'education';
  title: string;
  organization: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface CandidateProject {
  title: string;
  description: string;
  url: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface CandidateCertification {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  credentialUrl: string | null;
}

export interface CandidateLink {
  type: string;
  url: string;
  label: string | null;
}

export interface CandidateCv {
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
}

export interface CandidateDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  location: string | null;
  skills: string[];
  featured: boolean;
  // Comparison signals also shown on the list card.
  score?: number;
  percentile?: number | null;
  school?: string | null;
  schoolVerified?: boolean;
  assessmentCount?: number;
  // EF-SRCH-05 — true until the recruiter has contacted the candidate; the last
  // name stays an initial and full identity is withheld.
  anonymized?: boolean;
  // EF-CAND-05 — availability/mobility always shown; salary only if disclosed.
  availability?: string | null;
  mobility?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  // EF-CAND-07 — "proof of work" sections. bio/experiences/projects/
  // certifications are shown to any recruiter; links and the CV file carry
  // identity, so they arrive only once the recruiter has contacted the
  // candidate (or is an admin) — cv is null and links empty otherwise.
  bio?: string | null;
  experiences?: CandidateExperience[];
  projects?: CandidateProject[];
  certifications?: CandidateCertification[];
  links?: CandidateLink[];
  cv?: CandidateCv | null;
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
