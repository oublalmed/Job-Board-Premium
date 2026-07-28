import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { Recruiter } from '../companies/entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { SearchService } from './search.service.js';
import { SearchCandidatesDto } from './dto/search-candidates.dto.js';

const ACTIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
];

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.ADMIN)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  @Get('candidates')
  async searchCandidates(
    @CurrentUser() user: JwtPayload,
    @Query() filters: SearchCandidatesDto,
  ) {
    if (!user.roles.includes(Role.ADMIN)) {
      await this.assertActiveSubscription(user.sub);
    }

    return this.searchService.searchCandidates(filters);
  }

  private async assertActiveSubscription(userId: string): Promise<void> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId },
    });
    if (!recruiter) {
      throw new ForbiddenException(
        'Aucun compte recruteur associé à cet utilisateur',
      );
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId: recruiter.companyId },
      order: { createdAt: 'DESC' },
    });

    const isActive =
      !!subscription &&
      ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
      (!subscription.endsAt || subscription.endsAt > new Date());

    if (!isActive) {
      throw new ForbiddenException(
        'Un abonnement actif est requis pour accéder à la recherche',
      );
    }
  }
}
