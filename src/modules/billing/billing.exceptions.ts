import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SubscriptionPlan } from '../companies/entities/subscription.entity.js';

export class EnterpriseQuotaNotAutomatedException extends InternalServerErrorException {
  constructor() {
    super(
      'Enterprise plan contact quota is negotiated per contract, not automated — this plan cannot be provisioned from a webhook',
    );
  }
}

// Company already has an active/trial subscription — surfaced to the
// caller of POST /subscriptions as a 403 rather than silently letting a
// second Checkout Session be created that could never activate (the
// UQ_subscriptions_company_active index from Lot 6A would reject the
// webhook's activation attempt later, far from where the mistake was made).
export class CompanyAlreadySubscribedException extends ForbiddenException {
  constructor(companyId: string) {
    super(`Company ${companyId} already has an active or trial subscription`);
  }
}

// No ACTIVE/PAST_DUE row to cancel — e.g. still on TRIAL (nothing paid,
// nothing to schedule cancellation for) or already CANCELLED/EXPIRED.
export class NoActiveSubscriptionToCancelException extends NotFoundException {
  constructor(companyId: string) {
    super(`Company ${companyId} has no active subscription to cancel`);
  }
}

// No ACTIVE/PAST_DUE row to change the plan of — same reasoning as
// NoActiveSubscriptionToCancelException above, distinct endpoint.
export class NoActiveSubscriptionToChangePlanException extends NotFoundException {
  constructor(companyId: string) {
    super(`Company ${companyId} has no active subscription to change the plan of`);
  }
}

// A plan-change request for the plan the company is already on — not a
// meaningful proration (nothing changed), and calling Stripe with an
// identical price would be a wasted API call for zero business effect.
export class SamePlanException extends BadRequestException {
  constructor(plan: SubscriptionPlan) {
    super(`Subscription is already on the ${plan} plan`);
  }
}

// Lot 7 (EF-GROW-03) — a single, deliberately generic message for every
// invalid-code reason (nonexistent, revoked, expired, quota exhausted):
// distinguishing them to the caller would let someone probe which trial
// codes exist/still have uses left by trying candidates and reading the
// error apart.
export class InvalidTrialCodeException extends BadRequestException {
  constructor() {
    super('This trial code is not valid');
  }
}

// The redeeming company's current subscription isn't TRIAL (already
// ACTIVE/PAST_DUE/CANCELLED/EXPIRED, or somehow has none) — a promo code
// extends an existing trial, it does not reset a paying or churned
// customer back to one.
export class TrialCodeNotEligibleException extends ForbiddenException {
  constructor() {
    super('A trial code can only be redeemed while on a trial subscription');
  }
}

// This company has already redeemed a trial code before (companyId is
// unique on trial_code_redemptions) — surfaced distinctly from
// InvalidTrialCodeException so the caller understands it's their own
// account's history, not the code, that's the problem.
export class TrialCodeAlreadyRedeemedException extends ForbiddenException {
  constructor() {
    super('This company has already redeemed a trial code');
  }
}
