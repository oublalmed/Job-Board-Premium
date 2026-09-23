import { MetricsService } from '../metrics.service.js';

describe('MetricsService (ENF-09 — métriques centralisées)', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('exposes the custom HTTP histogram in the exposition output', async () => {
    // Observe once so the histogram actually emits sample lines (an untouched
    // histogram still declares its HELP/TYPE, which is enough to assert on).
    service.httpRequestDuration.observe(
      { method: 'GET', route: '/health', status_code: 200 },
      0.01,
    );

    const output = await service.metrics();

    expect(output).toContain('http_request_duration_seconds');
    expect(output.length).toBeGreaterThan(0);
  });

  it('includes default Node/process metrics', async () => {
    const output = await service.metrics();

    // collectDefaultMetrics registers process_cpu_* against our registry.
    expect(output).toContain('process_cpu');
  });

  it('reports the Prometheus text exposition content type', () => {
    expect(service.contentType).toBe(
      'text/plain; version=0.0.4; charset=utf-8',
    );
  });
});
