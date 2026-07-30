import { BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from './entities/subscription.entity.js';

export class InvalidSubscriptionTransitionException extends BadRequestException {
  constructor(from: SubscriptionStatus, to: SubscriptionStatus) {
    super(`Cannot transition subscription from "${from}" to "${to}"`);
  }
}
