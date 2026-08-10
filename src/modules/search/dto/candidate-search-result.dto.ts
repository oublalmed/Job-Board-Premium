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
}

export interface SearchCandidatesResult {
  items: CandidateSearchResultDto[];
  nextCursor: string | null;
}
