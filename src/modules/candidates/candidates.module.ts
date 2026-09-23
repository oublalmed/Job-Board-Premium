import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { Skill } from './entities/skill.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Document } from './entities/document.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ProfileLink } from './entities/profile-link.entity.js';
import { Certification } from './entities/certification.entity.js';
import { Project } from './entities/project.entity.js';
import { DataRequest } from './entities/data-request.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { CandidateProfileController } from './candidate-profile.controller.js';
import { CandidateDocumentService } from './candidate-document.service.js';
import { CandidateDocumentController } from './candidate-document.controller.js';
import { CandidateDataService } from './candidate-data.service.js';
import { CandidateDataController } from './candidate-data.controller.js';
import { DataRequestService } from './data-request.service.js';
import { DataRequestAdminController } from './data-request-admin.controller.js';
import { SkillCatalogService } from './skill-catalog.service.js';
import { SkillCatalogController } from './skill-catalog.controller.js';
import { CandidateExperienceService } from './candidate-experience.service.js';
import { CandidateExperienceController } from './candidate-experience.controller.js';
import { CandidateLinkService } from './candidate-link.service.js';
import { CandidateLinkController } from './candidate-link.controller.js';
import { CandidateSkillService } from './candidate-skill.service.js';
import { CandidateSkillController } from './candidate-skill.controller.js';
import { CandidateCertificationService } from './candidate-certification.service.js';
import { CandidateCertificationController } from './candidate-certification.controller.js';
import { CandidateProjectService } from './candidate-project.service.js';
import { CandidateProjectController } from './candidate-project.controller.js';
import { LinkVerificationService } from './link-verification.service.js';
import { LinkVerificationProcessor } from './link-verification.processor.js';
import { LinkVerificationEnqueuer } from './link-verification-enqueuer.service.js';
import { LINK_VERIFICATION_QUEUE } from './link-verification.constants.js';
import { LINK_PROBER } from '../../ports/link-prober.port.js';
import { HttpLinkProberAdapter } from '../../adapters/link-prober/http-link-prober.adapter.js';
import { StubLinkProberAdapter } from '../../adapters/link-prober/stub-link-prober.adapter.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: LINK_VERIFICATION_QUEUE }),
    TypeOrmModule.forFeature([
      CandidateProfile,
      Skill,
      ProfileSkill,
      Document,
      Experience,
      ProfileLink,
      Certification,
      Project,
      DataRequest,
      User,
    ]),
  ],
  controllers: [
    CandidateProfileController,
    CandidateDocumentController,
    CandidateDataController,
    DataRequestAdminController,
    SkillCatalogController,
    CandidateExperienceController,
    CandidateLinkController,
    CandidateSkillController,
    CandidateCertificationController,
    CandidateProjectController,
  ],
  providers: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
    DataRequestService,
    SkillCatalogService,
    CandidateExperienceService,
    CandidateLinkService,
    CandidateSkillService,
    CandidateCertificationService,
    CandidateProjectService,
    LinkVerificationService,
    LinkVerificationProcessor,
    LinkVerificationEnqueuer,
    // EF-CAND-04 — real HTTP prober in prod, deterministic no-network stub in
    // CI/dev; selected by LINK_PROBER_DRIVER (default 'http'). Same convention
    // as the antivirus scanner (ANTIVIRUS_DRIVER).
    {
      provide: LINK_PROBER,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('business.linkProberDriver', 'http');
        return driver === 'stub'
          ? new StubLinkProberAdapter()
          : new HttpLinkProberAdapter(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
    DataRequestService,
    TypeOrmModule,
  ],
})
export class CandidatesModule {}
