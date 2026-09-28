import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';
import { Feature, LimitKey } from '../feature.enum.js';
import {
  entitlementsForPlan,
  PLAN_DISPLAY_NAME,
} from '../entitlements.matrix.js';

describe('entitlements matrix (§9)', () => {
  it('labels growth/scale as Pro/Premium (display mapping)', () => {
    expect(PLAN_DISPLAY_NAME[SubscriptionPlan.STARTER]).toBe('Starter');
    expect(PLAN_DISPLAY_NAME[SubscriptionPlan.GROWTH]).toBe('Pro');
    expect(PLAN_DISPLAY_NAME[SubscriptionPlan.SCALE]).toBe('Premium');
    expect(PLAN_DISPLAY_NAME[SubscriptionPlan.ENTERPRISE]).toBe('Enterprise');
  });

  it('Starter: no Jobs, Shortlist, Anti-cheat, advanced analytics', () => {
    const f = entitlementsForPlan(SubscriptionPlan.STARTER).features;
    expect(f).toContain(Feature.CV_DATABASE);
    expect(f).toContain(Feature.SCORE_SORT);
    expect(f).not.toContain(Feature.JOBS);
    expect(f).not.toContain(Feature.SHORTLIST);
    expect(f).not.toContain(Feature.ANTI_CHEAT);
    expect(f).not.toContain(Feature.ADVANCED_ANALYTICS);
  });

  it('Pro (growth): Jobs, Shortlist, Export — but no Anti-cheat', () => {
    const f = entitlementsForPlan(SubscriptionPlan.GROWTH).features;
    expect(f).toContain(Feature.JOBS);
    expect(f).toContain(Feature.SHORTLIST);
    expect(f).toContain(Feature.EXPORT_CANDIDATES);
    expect(f).not.toContain(Feature.ANTI_CHEAT);
    expect(f).not.toContain(Feature.API_ACCESS);
  });

  it('Premium (scale): adds Anti-cheat + advanced analytics', () => {
    const f = entitlementsForPlan(SubscriptionPlan.SCALE).features;
    expect(f).toContain(Feature.ANTI_CHEAT);
    expect(f).toContain(Feature.ADVANCED_ANALYTICS);
    expect(f).not.toContain(Feature.API_ACCESS);
  });

  it('Enterprise: adds API access', () => {
    const f = entitlementsForPlan(SubscriptionPlan.ENTERPRISE).features;
    expect(f).toContain(Feature.API_ACCESS);
  });

  it('limits: evaluations/month 3 → 20 → ∞ → ∞', () => {
    expect(
      entitlementsForPlan(SubscriptionPlan.STARTER).limits[
        LimitKey.MAX_EVALUATIONS_MONTH
      ],
    ).toBe(3);
    expect(
      entitlementsForPlan(SubscriptionPlan.GROWTH).limits[
        LimitKey.MAX_EVALUATIONS_MONTH
      ],
    ).toBe(20);
    expect(
      entitlementsForPlan(SubscriptionPlan.SCALE).limits[
        LimitKey.MAX_EVALUATIONS_MONTH
      ],
    ).toBeNull();
    expect(
      entitlementsForPlan(SubscriptionPlan.ENTERPRISE).limits[
        LimitKey.MAX_USERS
      ],
    ).toBeNull();
  });
});
