import { createHmac } from 'node:crypto';
import { StubScoringAdapter } from '../stub-scoring.adapter.js';

const SECRET = 'test-webhook-secret';

function sign(payload: Buffer, secret = SECRET): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function makeAdapter(secret: string | undefined = SECRET): StubScoringAdapter {
  const configService = {
    get: jest.fn(
      (_key: string, defaultValue?: string) => secret ?? defaultValue,
    ),
  };
  return new StubScoringAdapter(
    configService as unknown as ConstructorParameters<
      typeof StubScoringAdapter
    >[0],
  );
}

describe('StubScoringAdapter', () => {
  describe('createAssessment / getResult / cancelAssessment', () => {
    const adapter = makeAdapter();

    it('should create an assessment', async () => {
      const result = await adapter.createAssessment({
        candidateId: 'c1',
        specialtyId: 's1',
        testId: 't1',
      });
      expect(result.externalId).toBeDefined();
      expect(result.assessmentUrl).toContain(result.externalId);
    });

    it('should return a stubbed result', async () => {
      const result = await adapter.getResult('ext-123');
      expect(result).not.toBeNull();
      expect(result!.score).toBe(65);
      expect(result!.maxScore).toBe(100);
    });

    it('should cancel without error', async () => {
      await expect(
        adapter.cancelAssessment('ext-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('verifyWebhookSignature — HMAC-SHA256', () => {
    const payload = Buffer.from(JSON.stringify({ externalId: 'ext-123' }));

    it('(c) accepts a correctly signed payload and extracts the externalId', async () => {
      const adapter = makeAdapter(SECRET);
      const signature = sign(payload);

      const result = await adapter.verifyWebhookSignature(payload, signature);

      expect(result.valid).toBe(true);
      expect(result.externalId).toBe('ext-123');
    });

    it('(a) rejects a call with no signature header', async () => {
      const adapter = makeAdapter(SECRET);

      const result = await adapter.verifyWebhookSignature(payload, '');

      expect(result.valid).toBe(false);
      expect(result.externalId).toBeNull();
    });

    it('(b) rejects a call with a wrong signature', async () => {
      const adapter = makeAdapter(SECRET);
      const wrongSignature = sign(payload, 'a-completely-different-secret');

      const result = await adapter.verifyWebhookSignature(
        payload,
        wrongSignature,
      );

      expect(result.valid).toBe(false);
      expect(result.externalId).toBeNull();
    });

    it('rejects a signature computed over a different payload (tampering)', async () => {
      const adapter = makeAdapter(SECRET);
      const originalSignature = sign(payload);
      const tamperedPayload = Buffer.from(
        JSON.stringify({ externalId: 'ext-123', score: 999 }),
      );

      const result = await adapter.verifyWebhookSignature(
        tamperedPayload,
        originalSignature,
      );

      expect(result.valid).toBe(false);
    });

    it('fails closed when no webhook secret is configured, even with a well-formed signature', async () => {
      const adapter = makeAdapter('');
      const signature = sign(payload, '');

      const result = await adapter.verifyWebhookSignature(payload, signature);

      expect(result.valid).toBe(false);
      expect(result.externalId).toBeNull();
    });

    it('does not throw on a signature of a different length than the expected HMAC', async () => {
      const adapter = makeAdapter(SECRET);

      const result = await adapter.verifyWebhookSignature(payload, 'short');

      expect(result.valid).toBe(false);
    });

    it('returns a null externalId when the verified payload is not valid JSON', async () => {
      const adapter = makeAdapter(SECRET);
      const rawPayload = Buffer.from('not-json');
      const signature = sign(rawPayload);

      const result = await adapter.verifyWebhookSignature(
        rawPayload,
        signature,
      );

      expect(result.valid).toBe(true);
      expect(result.externalId).toBeNull();
    });
  });
});
