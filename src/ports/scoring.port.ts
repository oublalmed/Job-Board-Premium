export interface CreateAssessmentRequest {
  candidateId: string;
  specialtyId: string;
  testId: string;
}

export type DomainFeedbackLevel = 'weak' | 'medium' | 'strong';

// A closed shape, deliberately — this is what makes "never leak a question
// or an answer" structural rather than a discipline every future caller has
// to remember. `domain` is a competency label (e.g. "Algorithmes"), never a
// question/item identifier from the test bank; there is no field this type
// could carry that would let one through.
export interface DomainFeedbackEntry {
  domain: string;
  level: DomainFeedbackLevel;
}

export interface AssessmentResult {
  externalId: string;
  // Already-composited score, kept for providers that don't split their
  // result into a technique/psychotechnique breakdown — WebhookService
  // falls back to score/maxScore when technicalScore/psychotechnicalScore
  // are absent.
  score: number;
  maxScore: number;
  percentile: number | null;
  plagiarismVerdict: 'clean' | 'suspected' | 'confirmed';
  details: Record<string, unknown>;
  // Lot 7 (EF-REM-01) — per-domain strengths/weaknesses for the
  // remediation feedback. Stubbed today (StubScoringAdapter fabricates a
  // plausible breakdown); a real vendor adapter would populate this from
  // whatever per-topic rubric their platform actually returns.
  domainFeedback: DomainFeedbackEntry[];
  // The pivot's évaluation composition (60% technique + 40%
  // psychotechnique by default, see webhook.service.ts) — both 0-100,
  // optional so a provider that only returns a single composited score
  // still works. When present, WebhookService derives `value` from these
  // instead of score/maxScore.
  technicalScore?: number;
  psychotechnicalScore?: number;
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
