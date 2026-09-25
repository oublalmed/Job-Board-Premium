import { Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

// ENF-09 — optional OpenTelemetry distributed tracing. OFF by default so the
// default run (and CI) is unaffected; enable in an environment that has a
// collector by setting OTEL_ENABLED=true. Service name and OTLP endpoint are
// read from the standard env vars (OTEL_SERVICE_NAME,
// OTEL_EXPORTER_OTLP_ENDPOINT) by the SDK/exporter, so no code change is needed
// to point it at a backend. Auto-instruments HTTP + Express; each request's
// span carries the correlation id already set by correlation-id.middleware.
let sdk: NodeSDK | undefined;

export function isTracingEnabled(): boolean {
  return process.env['OTEL_ENABLED'] === 'true';
}

export function startTracing(): void {
  if (!isTracingEnabled()) return;
  const logger = new Logger('Tracing');
  try {
    sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
      ],
    });
    sdk.start();
    logger.log('OpenTelemetry tracing started (OTLP/HTTP exporter)');
  } catch (error) {
    // Never let observability wiring take down the app.
    logger.warn(`OpenTelemetry failed to start: ${(error as Error).message}`);
  }
}

export async function stopTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    // Best-effort flush on shutdown.
  }
}
