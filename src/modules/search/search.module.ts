import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { ProfileViewService } from './profile-view.service.js';
import { CandidateProfileView } from './entities/candidate-profile-view.entity.js';
import { ProfileViewCooldown } from './entities/profile-view-cooldown.entity.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateProfileView, ProfileViewCooldown]),
    CandidatesModule,
    AssessmentsModule,
    CompaniesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, ProfileViewService],
})
export class SearchModule {}
