import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import { SearchService } from './search.service.js';
import { ProfileViewService } from './profile-view.service.js';
import { SearchCandidatesDto } from './dto/search-candidates.dto.js';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.ADMIN)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly profileViewService: ProfileViewService,
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

  @Get('candidates/:id')
  async getCandidateDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const isAdmin = user.roles.includes(Role.ADMIN);
    let companyId: string | undefined;
    if (!isAdmin) {
      ({ companyId } = await this.subscriptionGuard.assertActiveSubscription(
        user.sub,
      ));
    }

    // EF-SRCH-05 — full identity is revealed only to an admin, or to a
    // recruiter whose company already contacted this candidate.
    const detail = await this.searchService.getCandidateDetail(id, {
      isAdmin,
      companyId,
    });

    // Admins browse profiles without a company behind them — there's no
    // "a recruiter viewed you" story to tell a candidate about platform
    // staff, so tracking/notification is scoped to real recruiter views.
    if (companyId) {
      await this.profileViewService.recordView(user.sub, companyId, id);
    }

    return detail;
  }
}
