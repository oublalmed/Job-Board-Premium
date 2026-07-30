import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Shared by every "insert a dedup marker, let the constraint reject the
// duplicate" idempotence pattern in this codebase (Conversation's
// UNIQUE(candidate_id, company_id) in Lot 5B, ProcessedWebhookEvent's
// provider_event_id in Lot 6B) — one place to get the error-shape check
// right instead of reimplementing it per call site.
//
// constraintName is optional and matters when a transaction can violate
// MORE THAN ONE unique constraint (e.g. PaymentWebhookService: both the
// dedup marker AND Lot 6A's UQ_subscriptions_company_active can raise
// 23505 in the same transaction). Without it, any 23505 matches — correct
// only when a single unique constraint is reachable in that transaction
// (true for ConversationService, NOT true for PaymentWebhookService).
// Passing it narrows the check to that specific constraint by name
// (verified empirically: Postgres reports the backing index's name as the
// error's constraint field even for a bare CREATE UNIQUE INDEX, not only
// for a formal ADD CONSTRAINT) — a 23505 on any other constraint returns
// false here and must be treated as a real error, not a replay.
export function isUniqueViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  if (
    !(error instanceof QueryFailedError) ||
    (error as QueryFailedError & { code?: string }).code !==
      POSTGRES_UNIQUE_VIOLATION
  ) {
    return false;
  }

  if (constraintName === undefined) {
    return true;
  }

  return (
    (error as QueryFailedError & { constraint?: string }).constraint ===
    constraintName
  );
}
