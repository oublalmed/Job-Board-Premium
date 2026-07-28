export interface CreateAssessmentRequest {
  candidateId: string;
  specialtyId: string;
  testId: string;
}

export interface AssessmentResult {
  externalId: string;
  score: number;
  maxScore: number;
  percentile: number | null;
  plagiarismVerdict: 'clean' | 'suspected' | 'confirmed';
  details: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  externalId: string | null;
}

export interface ScoringProvider {
  createAssessment(
    request: CreateAssessmentRequest,
  ): Promise<{ externalId: string; assessmentUrl: string }>;
  getResult(externalId: string): Promise<AssessmentResult | null>;
  cancelAssessment(externalId: string): Promise<void>;
  verifyWebhookSignature(
    payload: Buffer,
    signature: string,
  ): Promise<WebhookVerificationResult>;
}

export const SCORING_PROVIDER = Symbol('SCORING_PROVIDER');
