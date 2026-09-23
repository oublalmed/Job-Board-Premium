import { MetricsController } from '../metrics.controller.js';
import { MetricsService } from '../metrics.service.js';

describe('MetricsController (ENF-09)', () => {
  it('returns the registry exposition payload', async () => {
    const metrics = jest
      .fn()
      .mockResolvedValue('# HELP http_request_duration_seconds');
    const controller = new MetricsController({
      metrics,
    } as unknown as MetricsService);

    await expect(controller.metrics()).resolves.toContain(
      'http_request_duration_seconds',
    );
    expect(metrics).toHaveBeenCalledTimes(1);
  });
});
