import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { ShortlistEntry } from './entities/shortlist-entry.entity.js';
import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { PublicCompanyController } from './public-company.controller.js';
import { RecruiterService } from './recruiter.service.js';
import { RecruiterController } from './recruiter.controller.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { ShortlistService } from './shortlist.service.js';
import { ShortlistController } from './shortlist.controller.js';
import { ContactQuotaService } from './contact-quota.service.js';
import { UsersModule } from '../users/users.module.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { CONTACT_QUOTA_PORT } from '../../ports/contact-quota.port.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Recruiter,
      Subscription,
      ShortlistEntry,
    ]),
    UsersModule,
    CandidatesModule,
  ],
  controllers: [
    CompanyController,
    PublicCompanyController,
    RecruiterController,
    ShortlistController,
  ],
  providers: [
    CompanyService,
    RecruiterService,
    SubscriptionGuardService,
    ShortlistService,
    ContactQuotaService,
    { provide: CONTACT_QUOTA_PORT, useClass: ContactQuotaService },
  ],
  exports: [
    TypeOrmModule,
    CompanyService,
    RecruiterService,
    SubscriptionGuardService,
    ContactQuotaService,
    CONTACT_QUOTA_PORT,
  ],
})
export class CompaniesModule {}
