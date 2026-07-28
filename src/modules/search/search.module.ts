import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [CandidatesModule, AssessmentsModule, CompaniesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
