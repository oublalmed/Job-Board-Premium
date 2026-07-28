import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ScoringProvider,
  CreateAssessmentRequest,
  AssessmentResult,
  WebhookVerificationResult,
} from '../../ports/scoring.port.js';

@Injectable()
export class StubScoringAdapter implements ScoringProvider {
  private readonly logger = new Logger(StubScoringAdapter.name);

  createAssessment(
    request: CreateAssessmentRequest,
  ): Promise<{ externalId: string; assessmentUrl: string }> {
    const externalId = uuidv4();
    this.logger.log(
      `[STUB] Assessment created for candidate ${request.candidateId}, externalId=${externalId}`,
    );
    return Promise.resolve({
      externalId,
      assessmentUrl: `https://stub-scoring.local/assessment/${externalId}`,
    });
  }

  getResult(externalId: string): Promise<AssessmentResult | null> {
    this.logger.log(`[STUB] Fetching result for assessment ${externalId}`);
    const score = 65;
    return Promise.resolve({
      externalId,
      score,
      maxScore: 100,
      percentile: 55,
      plagiarismVerdict: 'clean',
      details: { stub: true },
    });
  }

  cancelAssessment(externalId: string): Promise<void> {
    this.logger.log(`[STUB] Assessment ${externalId} cancelled`);
    return Promise.resolve();
  }

  verifyWebhookSignature(
    _payload: Buffer,
    _signature: string,
  ): Promise<WebhookVerificationResult> {
    return Promise.resolve({ valid: true, externalId: null });
  }
}
