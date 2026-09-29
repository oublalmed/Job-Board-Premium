import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobOffer } from './entities/job-offer.entity.js';
import { JobApplication } from './entities/job-application.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { JobsService } from './jobs.service.js';
import { ApplicationsService } from './applications.service.js';
import { JobsRecruiterController } from './jobs-recruiter.controller.js';
import { JobsPublicController } from './jobs-public.controller.js';

// §3 — job offers + applications. Recruiter management is gated by the JOBS
// feature (EntitlementService + FeatureGuard from the global EntitlementsModule).
@Module({
  imports: [
    TypeOrmModule.forFeature([JobOffer, JobApplication, CandidateProfile]),
  ],
  controllers: [JobsRecruiterController, JobsPublicController],
  providers: [JobsService, ApplicationsService],
})
export class JobsModule {}
