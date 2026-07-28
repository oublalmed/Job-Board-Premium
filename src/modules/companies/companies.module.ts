import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import { RecruiterService } from './recruiter.service.js';
import { RecruiterController } from './recruiter.controller.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, Recruiter, Subscription]),
    UsersModule,
  ],
  controllers: [CompanyController, RecruiterController],
  providers: [CompanyService, RecruiterService],
  exports: [TypeOrmModule, CompanyService, RecruiterService],
})
export class CompaniesModule {}
