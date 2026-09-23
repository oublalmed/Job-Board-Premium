import { Controller, Get, Header } from '@nestjs/common';
import { prometheusContentType } from 'prom-client';
import { MetricsService } from './metrics.service.js';

// ENF-09 (observabilité — métriques centralisées) — the Prometheus scrape
// target. Intentionally UNAUTHENTICATED, exactly like HealthController: this
// repo applies auth per-controller via @UseGuards(JwtAuthGuard) and has no
// global auth guard, so simply omitting a guard leaves the route public — the
// same mechanism that keeps /health scrapeable by the orchestrator. A scraper
// runs inside the cluster and must reach this without credentials; block it at
// the network layer, not with app auth.
//
// prometheusContentType is prom-client's own exposition-format constant
// ('text/plain; version=0.0.4; charset=utf-8'); using it here keeps the header
// in lockstep with what the registry actually emits.
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', prometheusContentType)
  metrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
