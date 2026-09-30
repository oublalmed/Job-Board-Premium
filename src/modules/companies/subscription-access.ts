import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity.js';
import { addDays } from '../../common/date-utils.js';

// Whether a subscription currently grants access (Lot 6D per-status rules).
// Extracted as a pure function so both SubscriptionGuardService (the "active
// subscription required" gate) and EntitlementService (feature resolution)
// share one definition instead of duplicating the status logic.
export function isSubscriptionWithinAccess(
  subscription: Subscription,
  gracePeriodDays: number,
  now: Date = new Date(),
): boolean {
  switch (subscription.status) {
    case SubscriptionStatus.ACTIVE:
      return true;
    case SubscriptionStatus.TRIAL:
      return !subscription.endsAt || subscription.endsAt > now;
    case SubscriptionStatus.PAST_DUE:
      if (!subscription.pastDueSince) {
        return true;
      }
      return addDays(subscription.pastDueSince, gracePeriodDays) > now;
    default:
      return false;
  }
}
