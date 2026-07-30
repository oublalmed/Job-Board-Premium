import { SubscriptionStatus } from '../entities/subscription.entity.js';
import {
  SUBSCRIPTION_STATUS_TRANSITIONS,
  assertValidSubscriptionTransition,
} from '../subscription-lifecycle.js';
import { InvalidSubscriptionTransitionException } from '../subscription-lifecycle.exceptions.js';

const ALL_STATUSES = Object.values(SubscriptionStatus);

describe('assertValidSubscriptionTransition', () => {
  describe('valid transitions', () => {
    for (const from of ALL_STATUSES) {
      for (const to of SUBSCRIPTION_STATUS_TRANSITIONS[from]) {
        it(`allows ${from} -> ${to}`, () => {
          expect(() =>
            assertValidSubscriptionTransition(from, to),
          ).not.toThrow();
        });
      }
    }
  });

  describe('invalid transitions', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const isDeclaredValid =
          SUBSCRIPTION_STATUS_TRANSITIONS[from].includes(to);
        if (isDeclaredValid) {
          continue;
        }

        it(`rejects ${from} -> ${to}`, () => {
          expect(() =>
            assertValidSubscriptionTransition(from, to),
          ).toThrow(InvalidSubscriptionTransitionException);
        });
      }
    }
  });

  describe('terminal statuses', () => {
    it('CANCELLED has no valid outgoing transition', () => {
      expect(
        SUBSCRIPTION_STATUS_TRANSITIONS[SubscriptionStatus.CANCELLED],
      ).toHaveLength(0);
    });

    it('EXPIRED has no valid outgoing transition', () => {
      expect(
        SUBSCRIPTION_STATUS_TRANSITIONS[SubscriptionStatus.EXPIRED],
      ).toHaveLength(0);
    });
  });

  it('rejects a same-status "transition" (not a real state change)', () => {
    expect(() =>
      assertValidSubscriptionTransition(
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.ACTIVE,
      ),
    ).toThrow(InvalidSubscriptionTransitionException);
  });
});
