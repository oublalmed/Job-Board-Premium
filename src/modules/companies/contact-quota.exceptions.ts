import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

export class SubscriptionInactiveException extends ForbiddenException {
  constructor(companyId: string) {
    super(`No active subscription for company ${companyId}`);
  }
}

export class ContactQuotaExceededException extends ForbiddenException {
  constructor(companyId: string) {
    super(`Contact quota exceeded for company ${companyId}`);
  }
}

// Not a caller-facing authorization failure (hence not ForbiddenException):
// this means the "at most one active subscription per company" invariant —
// enforced in application code, not by a DB constraint — has been violated.
// It must surface loudly as a server-side data problem, not be swallowed as
// a routine 403.
export class MultipleActiveSubscriptionsException extends InternalServerErrorException {
  constructor(companyId: string, count: number) {
    super(
      `Data invariant violation: company ${companyId} has ${count} active subscriptions, expected exactly 1`,
    );
  }
}
