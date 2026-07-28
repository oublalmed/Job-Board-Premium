import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { JobOffer } from './entities/job-offer.entity.js';
import { ShortlistEntry } from './entities/shortlist-entry.entity.js';
import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { RecruiterService } from './recruiter.service.js';
import { RecruiterController } from './recruiter.controller.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { JobOfferService } from './job-offer.service.js';
import { JobOfferController } from './job-offer.controller.js';
import { ShortlistService } from './shortlist.service.js';
import { ShortlistController } from './shortlist.controller.js';
import { UsersModule } from '../users/users.module.js';
import { CandidatesModule } from '../candidates/candidates.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Recruiter,
      Subscription,
      JobOffer,
      ShortlistEntry,
    ]),
    UsersModule,
    CandidatesModule,
  ],
  controllers: [
    CompanyController,
    RecruiterController,
    JobOfferController,
    ShortlistController,
  ],
  providers: [
    CompanyService,
    RecruiterService,
    SubscriptionGuardService,
    JobOfferService,
    ShortlistService,
  ],
  exports: [
    TypeOrmModule,
    CompanyService,
    RecruiterService,
    SubscriptionGuardService,
  ],
})
export class CompaniesModule {}
