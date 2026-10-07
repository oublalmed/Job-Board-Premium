import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { RecruiterInvitation } from './entities/recruiter-invitation.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { ShortlistEntry } from './entities/shortlist-entry.entity.js';
import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { PublicCompanyController } from './public-company.controller.js';
import { RecruiterService } from './recruiter.service.js';
import { RecruiterController } from './recruiter.controller.js';
import { RecruiterInvitationService } from './recruiter-invitation.service.js';
import { RecruiterInvitationController } from './recruiter-invitation.controller.js';
import { RecruiterInvitationPublicController } from './recruiter-invitation-public.controller.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { ShortlistService } from './shortlist.service.js';
import { ShortlistController } from './shortlist.controller.js';
import { ContactQuotaService } from './contact-quota.service.js';
import { SubscriptionAdminService } from './subscription-admin.service.js';
import { SubscriptionAdminController } from './subscription-admin.controller.js';
import { RecruiterAdminService } from './recruiter-admin.service.js';
import { RecruiterAdminController } from './recruiter-admin.controller.js';
import { UsersModule } from '../users/users.module.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { CONTACT_QUOTA_PORT } from '../../ports/contact-quota.port.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Recruiter,
      RecruiterInvitation,
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
    RecruiterInvitationController,
    RecruiterInvitationPublicController,
    ShortlistController,
    SubscriptionAdminController,
    RecruiterAdminController,
  ],
  providers: [
    CompanyService,
    RecruiterService,
    RecruiterInvitationService,
    SubscriptionGuardService,
    ShortlistService,
    ContactQuotaService,
    SubscriptionAdminService,
    RecruiterAdminService,
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
