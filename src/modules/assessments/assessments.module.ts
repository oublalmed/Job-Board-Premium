import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialty } from './entities/specialty.entity.js';
import { Test } from './entities/test.entity.js';
import { Assessment } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { AssessmentService } from './assessment.service.js';
import { AssessmentController } from './assessment.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Specialty, Test, Assessment, Score])],
  controllers: [AssessmentController],
  providers: [AssessmentService],
  exports: [TypeOrmModule, AssessmentService],
})
export class AssessmentsModule {}
