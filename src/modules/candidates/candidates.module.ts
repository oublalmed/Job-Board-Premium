import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { Skill } from './entities/skill.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Document } from './entities/document.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ProfileLink } from './entities/profile-link.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { CandidateProfileController } from './candidate-profile.controller.js';
import { CandidateDocumentService } from './candidate-document.service.js';
import { CandidateDocumentController } from './candidate-document.controller.js';
import { CandidateDataService } from './candidate-data.service.js';
import { CandidateDataController } from './candidate-data.controller.js';
import { SkillCatalogService } from './skill-catalog.service.js';
import { SkillCatalogController } from './skill-catalog.controller.js';
import { CandidateExperienceService } from './candidate-experience.service.js';
import { CandidateExperienceController } from './candidate-experience.controller.js';
import { CandidateLinkService } from './candidate-link.service.js';
import { CandidateLinkController } from './candidate-link.controller.js';
import { CandidateSkillService } from './candidate-skill.service.js';
import { CandidateSkillController } from './candidate-skill.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateProfile,
      Skill,
      ProfileSkill,
      Document,
      Experience,
      ProfileLink,
      User,
    ]),
  ],
  controllers: [
    CandidateProfileController,
    CandidateDocumentController,
    CandidateDataController,
    SkillCatalogController,
    CandidateExperienceController,
    CandidateLinkController,
    CandidateSkillController,
  ],
  providers: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
    SkillCatalogService,
    CandidateExperienceService,
    CandidateLinkService,
    CandidateSkillService,
  ],
  exports: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
    TypeOrmModule,
  ],
})
export class CandidatesModule {}
