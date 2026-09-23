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
}

export interface SearchCandidatesResult {
  items: CandidateSearchResultDto[];
  nextCursor: string | null;
}
