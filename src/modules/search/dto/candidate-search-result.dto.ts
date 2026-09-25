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
  // Signals that let a recruiter compare candidates at a glance: their school
  // (and whether it was admin-verified) and how many evaluations they have
  // completed.
  school: string | null;
  schoolVerified: boolean;
  assessmentCount: number;
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
  // EF-CAND-07 / EF-RECR-04 — rich detail-only sections a recruiter uses to
  // evaluate a candidate beyond the score: a free-text summary, work/education
  // history, projects delivered and certifications earned. Present only on the
  // candidate detail response (undefined on list rows).
  bio?: string | null;
  experiences?: CandidateExperienceDto[];
  projects?: CandidateProjectDto[];
  certifications?: CandidateCertificationDto[];
  // Personal links (GitHub/portfolio/LinkedIn) and the downloadable CV both
  // carry identifying information, so they are revealed only once the recruiter
  // has earned the identity reveal (admin, or a company that already contacted
  // the candidate). Otherwise `cv` is null and `links` is an empty array.
  links?: CandidateLinkDto[];
  cv?: CandidateCvDto | null;
}

export interface CandidateExperienceDto {
  type: 'work' | 'education';
  title: string;
  organization: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface CandidateProjectDto {
  title: string;
  description: string;
  url: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface CandidateCertificationDto {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  credentialUrl: string | null;
}

export interface CandidateLinkDto {
  type: string;
  url: string;
  label: string | null;
}

export interface CandidateCvDto {
  originalName: string;
  mimeType: string;
  size: number;
  // Short-lived signed URL the recruiter's browser can download directly.
  downloadUrl: string;
}

export interface SearchCandidatesResult {
  items: CandidateSearchResultDto[];
  nextCursor: string | null;
}
