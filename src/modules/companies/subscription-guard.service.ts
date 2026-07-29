import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recruiter } from './entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity.js';

const ACTIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
];

@Injectable()
export class SubscriptionGuardService {
  constructor(
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  // Returns companyId so callers that also need it skip a second query.
  async assertActiveSubscription(
    userId: string,
  ): Promise<{ companyId: string }> {
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
        'Un abonnement actif est requis pour accéder à cette fonctionnalité',
      );
    }

    return { companyId: recruiter.companyId };
  }

  // Company resolution only, no subscription check — used by mutations that
  // must scope to the caller's company regardless of subscription state
  // (e.g. removing a recruiter, closing an offer).
  async resolveCompanyId(userId: string): Promise<string> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId },
    });
    if (!recruiter) {
      throw new NotFoundException('No company associated with this account');
    }
    return recruiter.companyId;
  }
}
