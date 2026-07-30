import { SubscriptionStatus } from './entities/subscription.entity.js';
import { InvalidSubscriptionTransitionException } from './subscription-lifecycle.exceptions.js';

// The billing lifecycle this repo will build on top of in Lot 6B+ (Stripe
// webhooks, dunning). Defined now, ahead of any caller, so that whatever
// wires up webhook handling later has a single source of truth to consult
// instead of letting any status overwrite any other. CANCELLED and EXPIRED
// are terminal: a company that wants to subscribe again gets a new
// Subscription row (that's exactly why the partial unique index only
// covers TRIAL/ACTIVE — terminal rows are expected to accumulate).
export const SUBSCRIPTION_STATUS_TRANSITIONS: Readonly<
  Record<SubscriptionStatus, readonly SubscriptionStatus[]>
> = {
  [SubscriptionStatus.TRIAL]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELLED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELLED,
  ],
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
  ],
  [SubscriptionStatus.CANCELLED]: [],
  [SubscriptionStatus.EXPIRED]: [],
};

// Throws rather than returning a boolean: every caller of a status
// transition must handle rejection explicitly, not silently no-op or
// overwrite. A same-status "transition" (from === to) is also rejected —
// it isn't in any status's allowed-targets list — callers that want
// idempotent handling of repeated events (e.g. a replayed webhook) must
// check that themselves before calling.
export function assertValidSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  if (!SUBSCRIPTION_STATUS_TRANSITIONS[from].includes(to)) {
    throw new InvalidSubscriptionTransitionException(from, to);
  }
}
