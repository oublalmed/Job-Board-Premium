import { StubPaymentAdapter } from '../payment/stub-payment.adapter.js';
import { StubMailAdapter } from '../mail/stub-mail.adapter.js';
import { StubFileScannerAdapter } from '../file-scanner/stub-file-scanner.adapter.js';
import { StubObjectStorageAdapter } from '../object-storage/stub-object-storage.adapter.js';

// StubScoringAdapter has its own dedicated suite: see
// src/adapters/scoring/__tests__/stub-scoring.adapter.spec.ts

describe('StubPaymentAdapter', () => {
  const adapter = new StubPaymentAdapter();

  it('should create a checkout session', async () => {
    const result = await adapter.createCheckout({
      companyId: 'c1',
      planId: 'starter',
      amount: 990,
      currency: 'MAD',
    });
    expect(result.sessionId).toBeDefined();
    expect(result.checkoutUrl).toContain(result.sessionId);
  });

  it('should always verify webhook signature as true', () => {
    expect(adapter.verifyWebhookSignature('payload', 'sig')).toBe(true);
  });

  it('should parse webhook event', () => {
    const event = adapter.parseWebhookEvent('{}');
    expect(event.eventType).toBe('payment.success');
  });

  it('should cancel subscription without error', async () => {
    await expect(
      adapter.cancelSubscription('sub-123'),
    ).resolves.toBeUndefined();
  });
});

describe('StubMailAdapter', () => {
  const adapter = new StubMailAdapter();

  beforeEach(() => adapter.clearSentMails());

  it('should send an email and store it', async () => {
    const result = await adapter.send({
      to: 'user@example.com',
      subject: 'Test',
      templateId: 'welcome',
      variables: { name: 'John' },
    });
    expect(result.messageId).toBeDefined();
    expect(adapter.getSentMails()).toHaveLength(1);
    expect(adapter.getSentMails()[0].to).toBe('user@example.com');
  });

  it('should clear sent mails', async () => {
    await adapter.send({
      to: 'a@b.com',
      subject: 'x',
      templateId: 'y',
      variables: {},
    });
    adapter.clearSentMails();
    expect(adapter.getSentMails()).toHaveLength(0);
  });
});

describe('StubFileScannerAdapter', () => {
  const adapter = new StubFileScannerAdapter();

  it('should always return clean result', async () => {
    const result = await adapter.scan(Buffer.from('test'), 'file.pdf');
    expect(result.clean).toBe(true);
    expect(result.threat).toBeUndefined();
  });
});

describe('StubObjectStorageAdapter', () => {
  const adapter = new StubObjectStorageAdapter();

  it('should upload a file', async () => {
    const result = await adapter.upload({
      key: 'test/file.pdf',
      body: Buffer.from('content'),
      contentType: 'application/pdf',
    });
    expect(result.key).toBe('test/file.pdf');
    expect(result.url).toContain('test/file.pdf');
  });

  it('should check existence after upload', async () => {
    await adapter.upload({
      key: 'exists.txt',
      body: Buffer.from('data'),
      contentType: 'text/plain',
    });
    expect(await adapter.exists('exists.txt')).toBe(true);
    expect(await adapter.exists('nope.txt')).toBe(false);
  });

  it('should generate signed URL', async () => {
    const url = await adapter.getSignedUrl('key', 600);
    expect(url).toContain('key');
    expect(url).toContain('600');
  });

  it('should delete a file', async () => {
    await adapter.upload({
      key: 'to-delete.txt',
      body: Buffer.from('data'),
      contentType: 'text/plain',
    });
    await adapter.delete('to-delete.txt');
    expect(await adapter.exists('to-delete.txt')).toBe(false);
  });
});
