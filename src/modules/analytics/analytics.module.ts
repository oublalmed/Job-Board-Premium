import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsAdminController } from './analytics-admin.controller.js';

// Global so any module can inject AnalyticsService and emit funnel events
// (EF-ADM-05) without importing this module — event-tracking is a
// cross-cutting concern touching auth, assessments, messaging, billing.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsAdminController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
