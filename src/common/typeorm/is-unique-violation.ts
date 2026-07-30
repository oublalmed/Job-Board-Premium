import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Shared by every "insert a dedup marker, let the constraint reject the
// duplicate" idempotence pattern in this codebase (Conversation's
// UNIQUE(candidate_id, company_id) in Lot 5B, ProcessedWebhookEvent's
// provider_event_id in Lot 6B) — one place to get the error-shape check
// right instead of reimplementing it per call site.
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { code?: string }).code ===
      POSTGRES_UNIQUE_VIOLATION
  );
}
