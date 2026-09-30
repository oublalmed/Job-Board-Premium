import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity.js';
import { AnalyticsService } from './analytics.service.js';
import { RecruiterAnalyticsService } from './recruiter-analytics.service.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { AnalyticsAdminController } from './analytics-admin.controller.js';
import { AnalyticsRecruiterController } from './analytics-recruiter.controller.js';
import { JobOffer } from '../jobs/entities/job-offer.entity.js';
import { JobApplication } from '../jobs/entities/job-application.entity.js';
import { ShortlistEntry } from '../companies/entities/shortlist-entry.entity.js';
import { Conversation } from '../messaging/entities/conversation.entity.js';
import { Subscription } from '../companies/entities/subscription.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { Assessment } from '../assessments/entities/assessment.entity.js';

// Global so any module can inject AnalyticsService and emit funnel events
// (EF-ADM-05) without importing this module — event-tracking is a
// cross-cutting concern touching auth, assessments, messaging, billing.
// §4/§5 add read-only dashboards over existing tables (recruiter + admin);
// EntitlementService + FeatureGuard come from the global EntitlementsModule.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      JobOffer,
      JobApplication,
      ShortlistEntry,
      Conversation,
      Subscription,
      User,
      Company,
      Assessment,
    ]),
  ],
  controllers: [AnalyticsAdminController, AnalyticsRecruiterController],
  providers: [
    AnalyticsService,
    RecruiterAnalyticsService,
    AdminAnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
