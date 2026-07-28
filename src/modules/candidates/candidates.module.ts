import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { Skill } from './entities/skill.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Document } from './entities/document.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ProfileLink } from './entities/profile-link.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { CandidateProfileController } from './candidate-profile.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateProfile,
      Skill,
      ProfileSkill,
      Document,
      Experience,
      ProfileLink,
    ]),
  ],
  controllers: [CandidateProfileController],
  providers: [CandidateProfileService],
  exports: [CandidateProfileService, TypeOrmModule],
})
export class CandidatesModule {}
