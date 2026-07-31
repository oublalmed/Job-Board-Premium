import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { TrialCode, TrialCodeStatus } from './entities/trial-code.entity.js';
import {
  TrialCodeRedemption,
  TRIAL_CODE_REDEMPTION_COMPANY_UNIQUE_CONSTRAINT,
} from './entities/trial-code-redemption.entity.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import { resolveContactQuotaForPlan } from './plan-quota.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import {
  InvalidTrialCodeException,
  TrialCodeAlreadyRedeemedException,
  TrialCodeNotEligibleException,
} from './billing.exceptions.js';

export interface TrialCodeRedemptionResult {
  plan: Subscription['plan'];
  contactQuota: number;
  endsAt: Date;
}

@Injectable()
export class TrialCodeRedemptionService {
  constructor(
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // The trial is provisioned entirely without Stripe — this extends/
  // upgrades the company's EXISTING TRIAL row (every company gets one at
  // signup, CompanyService.createCompany) rather than creating a new one:
  // there is nothing to transition (TRIAL -> TRIAL is not a status change),
  // so this deliberately does NOT go through the 6A guard
  // (assertValidSubscriptionTransition) the way a real status change would.
  async redeem(
    userId: string,
    code: string,
  ): Promise<TrialCodeRedemptionResult> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(userId);

    return this.dataSource.transaction(async (manager) => {
      const subscriptionRepo = manager.getRepository(Subscription);
      const trialCodeRepo = manager.getRepository(TrialCode);
      const redemptionRepo = manager.getRepository(TrialCodeRedemption);

      // WHERE-scoped to companyId + TRIAL directly, never a load-then-check
      // of an arbitrary subscription row — same discipline as
      // ContactQuotaService.resolveActiveSubscriptionId.
      const subscription = await subscriptionRepo.findOne({
        where: { companyId, status: SubscriptionStatus.TRIAL },
        order: { createdAt: 'DESC' },
      });
      if (!subscription) {
        throw new TrialCodeNotEligibleException();
      }

      const trialCode = await trialCodeRepo.findOne({ where: { code } });
      if (!this.isCurrentlyRedeemable(trialCode)) {
        throw new InvalidTrialCodeException();
      }

      // Anti-double-activation / anti-stacking: the redemption row's own
      // UNIQUE(company_id) is the actual guard, not this insert succeeding
      // — a concurrent second redemption for the same company loses the
      // race here and the whole transaction (including the quota claim and
      // subscription update below) rolls back with it.
      try {
        await redemptionRepo.insert({ trialCodeId: trialCode.id, companyId });
      } catch (error) {
        if (
          isUniqueViolation(
            error,
            TRIAL_CODE_REDEMPTION_COMPANY_UNIQUE_CONSTRAINT,
          )
        ) {
          throw new TrialCodeAlreadyRedeemedException();
        }
        throw error;
      }

      // Atomic conditional UPDATE, not a read-then-write — same family as
      // ContactQuotaService.consumeOneContact: this is what keeps
      // concurrent redemptions of a code near its maxUses limit from ever
      // pushing usedCount past it.
      const claim = await trialCodeRepo
        .createQueryBuilder()
        .update(TrialCode)
        .set({ usedCount: () => 'used_count + 1' })
        .where('id = :id', { id: trialCode.id })
        .andWhere('used_count < max_uses')
        .andWhere('status = :status', { status: TrialCodeStatus.ACTIVE })
        .execute();
      if ((claim.affected ?? 0) === 0) {
        throw new InvalidTrialCodeException();
      }

      const contactQuota = resolveContactQuotaForPlan(
        trialCode.plan,
        this.configService,
      );
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + trialCode.trialDurationDays);

      subscription.plan = trialCode.plan;
      subscription.contactQuota = contactQuota;
      subscription.endsAt = endsAt;
      const saved = await subscriptionRepo.save(subscription);

      return {
        plan: saved.plan,
        contactQuota: saved.contactQuota,
        endsAt: saved.endsAt as Date,
      };
    });
  }

  private isCurrentlyRedeemable(
    trialCode: TrialCode | null,
  ): trialCode is TrialCode {
    if (!trialCode) {
      return false;
    }
    if (trialCode.status !== TrialCodeStatus.ACTIVE) {
      return false;
    }
    if (trialCode.expiresAt && trialCode.expiresAt <= new Date()) {
      return false;
    }
    if (trialCode.usedCount >= trialCode.maxUses) {
      return false;
    }
    return true;
  }
}
