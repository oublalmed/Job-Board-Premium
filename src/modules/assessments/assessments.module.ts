import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialty } from './entities/specialty.entity.js';
import { Test } from './entities/test.entity.js';
import { Assessment } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { AssessmentService } from './assessment.service.js';
import { AssessmentController } from './assessment.controller.js';
import { WebhookService } from './webhook.service.js';
import { WebhookController } from './webhook.controller.js';
import { IndexationService } from './indexation.service.js';
import { RemediationService } from './remediation.service.js';
import { CandidatesModule } from '../candidates/candidates.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Specialty, Test, Assessment, Score]),
    CandidatesModule,
  ],
  controllers: [AssessmentController, WebhookController],
  providers: [
    AssessmentService,
    WebhookService,
    IndexationService,
    RemediationService,
  ],
  exports: [
    TypeOrmModule,
    AssessmentService,
    WebhookService,
    IndexationService,
  ],
})
export class AssessmentsModule {}
