import { isTracingEnabled, startTracing, stopTracing } from '../tracing.js';

describe('tracing (ENF-09)', () => {
  const original = process.env['OTEL_ENABLED'];
  afterEach(() => {
    if (original === undefined) delete process.env['OTEL_ENABLED'];
    else process.env['OTEL_ENABLED'] = original;
  });

  it('is disabled by default (no OTEL_ENABLED)', () => {
    delete process.env['OTEL_ENABLED'];
    expect(isTracingEnabled()).toBe(false);
  });

  it('is a no-op and never throws when disabled', async () => {
    delete process.env['OTEL_ENABLED'];
    expect(() => startTracing()).not.toThrow();
    await expect(stopTracing()).resolves.toBeUndefined();
  });

  it('reads the OTEL_ENABLED flag', () => {
    process.env['OTEL_ENABLED'] = 'true';
    expect(isTracingEnabled()).toBe(true);
    process.env['OTEL_ENABLED'] = 'false';
    expect(isTracingEnabled()).toBe(false);
  });
});
