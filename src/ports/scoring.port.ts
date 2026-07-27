export interface CreateAssessmentRequest {
  candidateId: string;
  specialtyId: string;
  testId: string;
}

export interface AssessmentResult {
  externalId: string;
  score: number;
  maxScore: number;
  details: Record<string, unknown>;
}

export interface ScoringProvider {
  createAssessment(
    request: CreateAssessmentRequest,
  ): Promise<{ externalId: string; assessmentUrl: string }>;
  getResult(externalId: string): Promise<AssessmentResult | null>;
  cancelAssessment(externalId: string): Promise<void>;
}

export const SCORING_PROVIDER = Symbol('SCORING_PROVIDER');
