import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Specialty } from './entities/specialty.entity.js';
import { Test } from './entities/test.entity.js';
import { Assessment } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { RemediationProgress } from './entities/remediation-progress.entity.js';
import { AssessmentService } from './assessment.service.js';
import { AssessmentHistoryService } from './assessment-history.service.js';
import { AssessmentController } from './assessment.controller.js';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import { WebhookService } from './webhook.service.js';
import { ExamService } from './exam.service.js';
import { WebhookController } from './webhook.controller.js';
import { IndexationService } from './indexation.service.js';
import { RemediationService } from './remediation.service.js';
import { RemediationProgressService } from './remediation-progress.service.js';
import { RemediationNotificationService } from './remediation-notification.service.js';
import { CooldownNotificationProcessor } from './cooldown-notification.processor.js';
import { CooldownSchedulerService } from './cooldown-scheduler.service.js';
import { COOLDOWN_QUEUE } from './cooldown-queue.constants.js';
import { PercentileRecalcService } from './percentile-recalc.service.js';
import { PercentileRecalcProcessor } from './percentile-recalc.processor.js';
import { PercentileRecalcSchedulerService } from './percentile-recalc-scheduler.service.js';
import { PERCENTILE_RECALC_QUEUE } from './percentile-recalc.constants.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Specialty,
      Test,
      Assessment,
      Score,
      RemediationProgress,
    ]),
    BullModule.registerQueue({ name: COOLDOWN_QUEUE }),
    BullModule.registerQueue({ name: PERCENTILE_RECALC_QUEUE }),
    CandidatesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [AssessmentController, WebhookController, CatalogController],
  providers: [
    AssessmentService,
    AssessmentHistoryService,
    WebhookService,
    ExamService,
    IndexationService,
    RemediationService,
    RemediationProgressService,
    RemediationNotificationService,
    CooldownNotificationProcessor,
    CooldownSchedulerService,
    PercentileRecalcService,
    PercentileRecalcProcessor,
    PercentileRecalcSchedulerService,
    CatalogService,
  ],
  exports: [
    TypeOrmModule,
    AssessmentService,
    WebhookService,
    IndexationService,
  ],
})
export class AssessmentsModule {}
