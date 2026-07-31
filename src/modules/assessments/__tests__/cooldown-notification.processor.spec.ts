import { CooldownNotificationProcessor } from '../cooldown-notification.processor.js';
import { RemediationNotificationService } from '../remediation-notification.service.js';

describe('CooldownNotificationProcessor', () => {
  it('delegates job processing to RemediationNotificationService.runCooldownSweep', async () => {
    const remediationNotificationService = {
      runCooldownSweep: jest.fn().mockResolvedValue({ notifiedCount: 3 }),
    } as unknown as RemediationNotificationService;

    const processor = new CooldownNotificationProcessor(remediationNotificationService);

    const result = await processor.process({ id: 'job-1' } as never);

    expect(remediationNotificationService.runCooldownSweep).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ notifiedCount: 3 });
  });

  it('does not throw when the worker error handler is invoked directly', () => {
    const remediationNotificationService = {
      runCooldownSweep: jest.fn(),
    } as unknown as RemediationNotificationService;
    const processor = new CooldownNotificationProcessor(remediationNotificationService);

    expect(() => processor.onWorkerError(new Error('connect ECONNREFUSED'))).not.toThrow();
  });
});
