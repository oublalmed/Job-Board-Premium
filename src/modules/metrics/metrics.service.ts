import { Injectable } from '@nestjs/common';
import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * ENF-09 (observabilité — métriques centralisées).
 *
 * Owns the single application-wide prom-client {@link Registry}. Everything a
 * Prometheus scraper reads at `GET /metrics` comes from this one registry, so
 * we deliberately do NOT use prom-client's global default registry: an isolated
 * instance keeps metric registration deterministic (no cross-module bleed) and
 * lets tests build a fresh service without tripping "metric already registered"
 * errors on the shared global.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  /**
   * Request latency histogram. The `route` label is the matched route *pattern*
   * (e.g. `/candidates/:id`), never the raw URL — see {@link HttpMetricsInterceptor}.
   * Bounding the label space this way is what keeps the metric's cardinality
   * finite (a per-URL label would blow up Prometheus' memory).
   */
  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_code'>;

  /** The Content-Type a Prometheus scraper expects for the exposition format. */
  readonly contentType: string = this.registry.contentType;

  constructor() {
    // Default Node/process metrics (process_cpu_*, nodejs_*, heap, event loop
    // lag, …). Registered against our registry only, once per instance.
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of inbound HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
  }

  /** The full exposition payload for the scrape endpoint. */
  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
