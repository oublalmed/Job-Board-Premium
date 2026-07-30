import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';

export class EnterpriseQuotaNotAutomatedException extends InternalServerErrorException {
  constructor() {
    super(
      'Enterprise plan contact quota is negotiated per contract, not automated — this plan cannot be provisioned from a webhook',
    );
  }
}

// Company already has an active/trial subscription — surfaced to the
// caller of POST /subscriptions as a 403 rather than silently letting a
// second Checkout Session be created that could never activate (the
// UQ_subscriptions_company_active index from Lot 6A would reject the
// webhook's activation attempt later, far from where the mistake was made).
export class CompanyAlreadySubscribedException extends ForbiddenException {
  constructor(companyId: string) {
    super(`Company ${companyId} already has an active or trial subscription`);
  }
}
