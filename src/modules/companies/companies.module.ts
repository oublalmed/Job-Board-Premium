import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { Subscription } from './entities/subscription.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Recruiter, Subscription])],
  exports: [TypeOrmModule],
})
export class CompaniesModule {}
