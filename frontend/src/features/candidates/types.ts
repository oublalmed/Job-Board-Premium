export interface CandidateResult {
  id: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  availability?: string;
  featured?: boolean;
}

export interface CandidateSearchResponse {
  results: CandidateResult[];
  nextCursor?: string | null;
  total?: number;
}

export interface CandidateDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  availability: string | null;
  mobility: string | null;
  location: string | null;
  skills: string[];
  featured: boolean;
}

/** Raw filter inputs as typed by the recruiter (skills is a comma string). */
export interface CandidateFilters {
  q: string;
  skills: string;
  location: string;
  availability: string;
  mobility: string;
}

export const EMPTY_FILTERS: CandidateFilters = {
  q: '',
  skills: '',
  location: '',
  availability: '',
  mobility: '',
};

export function activeFilterCount(f: CandidateFilters): number {
  return [f.skills, f.location, f.availability, f.mobility].filter((v) => v.trim()).length;
}
