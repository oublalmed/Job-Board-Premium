import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { Skill } from './entities/skill.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Document } from './entities/document.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateProfile, Skill, ProfileSkill, Document]),
  ],
  exports: [TypeOrmModule],
})
export class CandidatesModule {}
