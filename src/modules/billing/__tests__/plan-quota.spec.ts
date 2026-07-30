import { ConfigService } from '@nestjs/config';
import {
  resolveContactQuotaForPlan,
  resolveMonthlyPriceInCentimes,
} from '../plan-quota.js';
import { EnterpriseQuotaNotAutomatedException } from '../billing.exceptions.js';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

function makeConfigService(values: Record<string, number>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('plan-quota', () => {
  describe('resolveContactQuotaForPlan', () => {
    it('reads business.plans.<plan>.contacts — the same config CompanyService uses for trial provisioning', () => {
      const configService = makeConfigService({
        'business.plans.starter.contacts': 15,
        'business.plans.growth.contacts': 60,
        'business.plans.scale.contacts': 200,
      });

      expect(
        resolveContactQuotaForPlan(SubscriptionPlan.STARTER, configService),
      ).toBe(15);
      expect(
        resolveContactQuotaForPlan(SubscriptionPlan.GROWTH, configService),
      ).toBe(60);
      expect(
        resolveContactQuotaForPlan(SubscriptionPlan.SCALE, configService),
      ).toBe(200);
    });

    it('throws EnterpriseQuotaNotAutomatedException for ENTERPRISE — negotiated per contract, not automated', () => {
      const configService = makeConfigService({});
      expect(() =>
        resolveContactQuotaForPlan(SubscriptionPlan.ENTERPRISE, configService),
      ).toThrow(EnterpriseQuotaNotAutomatedException);
    });

    it('throws if a non-enterprise plan somehow has no configured quota', () => {
      const configService = makeConfigService({});
      expect(() =>
        resolveContactQuotaForPlan(SubscriptionPlan.STARTER, configService),
      ).toThrow();
    });
  });

  describe('resolveMonthlyPriceInCentimes', () => {
    it('converts whole-MAD config prices to centimes (x100)', () => {
      const configService = makeConfigService({
        'business.plans.starter.price': 990,
      });
      expect(
        resolveMonthlyPriceInCentimes(SubscriptionPlan.STARTER, configService),
      ).toBe(99000);
    });

    it('throws EnterpriseQuotaNotAutomatedException for ENTERPRISE', () => {
      const configService = makeConfigService({});
      expect(() =>
        resolveMonthlyPriceInCentimes(
          SubscriptionPlan.ENTERPRISE,
          configService,
        ),
      ).toThrow(EnterpriseQuotaNotAutomatedException);
    });
  });
});
