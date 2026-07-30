import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { SubscriptionPlan } from '../companies/entities/subscription.entity.js';
import { EnterpriseQuotaNotAutomatedException } from './billing.exceptions.js';

// Single typed source for plan -> contact quota, deliberately NOT a second
// mapping: it reads the same business.plans.<plan>.contacts config
// (src/config/business.config.ts) that already drives trial provisioning
// in CompanyService — no magic numbers duplicated here.
const CONTACT_QUOTA_CONFIG_KEY: Record<
  Exclude<SubscriptionPlan, SubscriptionPlan.ENTERPRISE>,
  string
> = {
  [SubscriptionPlan.STARTER]: 'business.plans.starter.contacts',
  [SubscriptionPlan.GROWTH]: 'business.plans.growth.contacts',
  [SubscriptionPlan.SCALE]: 'business.plans.scale.contacts',
};

const PRICE_CONFIG_KEY: Record<
  Exclude<SubscriptionPlan, SubscriptionPlan.ENTERPRISE>,
  string
> = {
  [SubscriptionPlan.STARTER]: 'business.plans.starter.price',
  [SubscriptionPlan.GROWTH]: 'business.plans.growth.price',
  [SubscriptionPlan.SCALE]: 'business.plans.scale.price',
};

export function resolveContactQuotaForPlan(
  plan: SubscriptionPlan,
  configService: ConfigService,
): number {
  if (plan === SubscriptionPlan.ENTERPRISE) {
    throw new EnterpriseQuotaNotAutomatedException();
  }

  const quota = configService.get<number>(CONTACT_QUOTA_CONFIG_KEY[plan]);
  if (quota === undefined) {
    throw new InternalServerErrorException(
      `No contact quota configured for plan ${plan}`,
    );
  }
  return quota;
}

// Config stores whole-MAD prices (e.g. 990 = 990 MAD/month); Stripe's
// unit_amount is the smallest currency unit (centimes) — the *100
// conversion happens here, once, rather than at every call site.
export function resolveMonthlyPriceInCentimes(
  plan: SubscriptionPlan,
  configService: ConfigService,
): number {
  if (plan === SubscriptionPlan.ENTERPRISE) {
    throw new EnterpriseQuotaNotAutomatedException();
  }

  const price = configService.get<number>(PRICE_CONFIG_KEY[plan]);
  if (price === undefined) {
    throw new InternalServerErrorException(
      `No price configured for plan ${plan}`,
    );
  }
  return price * 100;
}
