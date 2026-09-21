import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { ProfileViewService } from './profile-view.service.js';
import { SavedSearchService } from './saved-search.service.js';
import { SavedSearchController } from './saved-search.controller.js';
import { SavedSearchAlertService } from './saved-search-alert.service.js';
import { SavedSearchAlertProcessor } from './saved-search-alert.processor.js';
import { SavedSearchAlertSchedulerService } from './saved-search-alert-scheduler.service.js';
import { SAVED_SEARCH_ALERT_QUEUE } from './saved-search-alert.constants.js';
import { CandidateProfileView } from './entities/candidate-profile-view.entity.js';
import { ProfileViewCooldown } from './entities/profile-view-cooldown.entity.js';
import { SavedSearch } from './entities/saved-search.entity.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateProfileView,
      ProfileViewCooldown,
      SavedSearch,
    ]),
    BullModule.registerQueue({ name: SAVED_SEARCH_ALERT_QUEUE }),
    CandidatesModule,
    AssessmentsModule,
    CompaniesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [SearchController, SavedSearchController],
  providers: [
    SearchService,
    ProfileViewService,
    SavedSearchService,
    SavedSearchAlertService,
    SavedSearchAlertProcessor,
    SavedSearchAlertSchedulerService,
  ],
})
export class SearchModule {}
