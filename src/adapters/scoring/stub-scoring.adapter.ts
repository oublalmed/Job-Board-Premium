import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
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

  constructor(private readonly configService: ConfigService) {}

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
    payload: Buffer,
    signature: string,
  ): Promise<WebhookVerificationResult> {
    const secret = this.configService.get<string>('scoring.webhookSecret', '');

    // Fail closed: no secret configured means no signature can ever be
    // considered valid, rather than silently accepting every call.
    if (!secret || !signature) {
      return Promise.resolve({ valid: false, externalId: null });
    }

    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (!this.isSignatureMatch(expected, signature)) {
      return Promise.resolve({ valid: false, externalId: null });
    }

    return Promise.resolve({
      valid: true,
      externalId: this.extractExternalId(payload),
    });
  }

  private isSignatureMatch(expectedHex: string, providedHex: string): boolean {
    const expectedBuffer = Buffer.from(expectedHex, 'utf8');
    const providedBuffer = Buffer.from(providedHex, 'utf8');

    // timingSafeEqual throws on mismatched lengths instead of returning
    // false, so the length check must happen before calling it.
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private extractExternalId(payload: Buffer): string | null {
    try {
      const parsed = JSON.parse(payload.toString('utf8')) as Record<
        string,
        unknown
      >;
      return typeof parsed['externalId'] === 'string'
        ? parsed['externalId']
        : null;
    } catch {
      return null;
    }
  }
}
