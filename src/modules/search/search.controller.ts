import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import { SearchService } from './search.service.js';
import { SearchCandidatesDto } from './dto/search-candidates.dto.js';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.ADMIN)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly subscriptionGuard: SubscriptionGuardService,
  ) {}

  @Get('candidates')
  async searchCandidates(
    @CurrentUser() user: JwtPayload,
    @Query() filters: SearchCandidatesDto,
  ) {
    if (!user.roles.includes(Role.ADMIN)) {
      await this.subscriptionGuard.assertActiveSubscription(user.sub);
    }

    return this.searchService.searchCandidates(filters);
  }
}
