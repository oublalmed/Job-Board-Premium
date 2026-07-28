export interface CandidateSearchResultDto {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  availability: string | null;
  mobility: string | null;
  location: string | null;
  skills: string[];
  score: number;
  percentile: number | null;
  featured: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
}

export interface SearchCandidatesResult {
  items: CandidateSearchResultDto[];
  nextCursor: string | null;
}
