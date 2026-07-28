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
  ],
  providers: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
  ],
  exports: [
    CandidateProfileService,
    CandidateDocumentService,
    CandidateDataService,
    TypeOrmModule,
  ],
})
export class CandidatesModule {}
