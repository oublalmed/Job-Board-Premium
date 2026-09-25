export interface CandidateSearchResultDto {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  location: string | null;
  skills: string[];
  score: number;
  percentile: number | null;
  featured: boolean;
  // EF-SRCH-05 — true when the identity in this row is an anonymized preview
  // (last name reduced to an initial). Full identity is revealed only on the
  // candidate detail. Absent on the detail response (full identity).
  anonymized?: boolean;
  // EF-CAND-05 — availability / mobility / salary expectation, shown on the
  // candidate detail. The salary range is present only when the candidate has
  // not masked it (salaryVisible); availability & mobility are never masked.
  availability?: string | null;
  mobility?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
}

export interface SearchCandidatesResult {
  items: CandidateSearchResultDto[];
  nextCursor: string | null;
}
