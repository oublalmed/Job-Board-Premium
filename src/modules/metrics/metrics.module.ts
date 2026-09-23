import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';

// ENF-09 (observabilité — métriques centralisées). Self-contained and gated
// behind no env: importing this module is all it takes to expose /metrics and
// start timing every request. The interceptor is registered as a global
// APP_INTERCEPTOR here (rather than in main.ts) so it is constructed by Nest's
// DI and receives the singleton MetricsService.
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class MetricsModule {}
