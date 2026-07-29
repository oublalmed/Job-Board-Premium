import { ForbiddenException } from '@nestjs/common';

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
