import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolVerification } from './entities/school-verification.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { Document } from '../candidates/entities/document.entity.js';
import { SchoolVerificationService } from './school-verification.service.js';
import { SchoolVerificationController } from './school-verification.controller.js';
import { SchoolVerificationAdminController } from './school-verification-admin.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolVerification, CandidateProfile, Document]),
  ],
  controllers: [
    SchoolVerificationController,
    SchoolVerificationAdminController,
  ],
  providers: [SchoolVerificationService],
})
export class SchoolVerificationModule {}
