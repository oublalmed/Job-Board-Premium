import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ScoringProvider,
  CreateAssessmentRequest,
  AssessmentResult,
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
    return Promise.resolve({
      externalId,
      score: 65,
      maxScore: 100,
      details: { stub: true },
    });
  }

  cancelAssessment(externalId: string): Promise<void> {
    this.logger.log(`[STUB] Assessment ${externalId} cancelled`);
    return Promise.resolve();
  }
}
